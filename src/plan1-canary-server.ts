import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import path from "node:path";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PLAN1_PORT ?? 8790);
const MCP_PATH = process.env.PLAN1_MCP_PATH ?? "/mcp";
const TELEMETRY_BASE_URL =
  process.env.PLAN1_TELEMETRY_BASE_URL ?? `http://localhost:${PORT}`;
const MARKER_TEXT = "CODEx_UI_PROBE_READY";
const CANARY_WIDGET_URI = "ui://widget/plan1-canary.html";

const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts/plan1");
const PROBE_CHATGPT_EVENTS = path.join(
  ARTIFACTS_DIR,
  "probe-events-chatgpt.jsonl"
);
const PROBE_CODEX_EVENTS = path.join(ARTIFACTS_DIR, "probe-events-codex.jsonl");
const PROBE_UNKNOWN_EVENTS = path.join(
  ARTIFACTS_DIR,
  "probe-events-unknown.jsonl"
);

const probeEventSchema = z.object({
  host: z.enum(["chatgpt", "codex"]),
  sessionId: z.string().min(1),
  event: z.enum([
    "widget_mount",
    "bridge_detected",
    "bridge_method_ok",
    "bridge_error"
  ]),
  method: z.string().optional(),
  timestamp: z.string().optional(),
  detail: z.string().optional()
});

type ProbeEvent = z.infer<typeof probeEventSchema>;

const ensureArtifactFiles = (): void => {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const files = [PROBE_CHATGPT_EVENTS, PROBE_CODEX_EVENTS, PROBE_UNKNOWN_EVENTS];
  for (const file of files) {
    if (!existsSync(file)) {
      writeFileSync(file, "", "utf8");
    }
  }
};

const eventPathForHost = (host: string): string => {
  if (host === "chatgpt") return PROBE_CHATGPT_EVENTS;
  if (host === "codex") return PROBE_CODEX_EVENTS;
  return PROBE_UNKNOWN_EVENTS;
};

const appendEvent = (event: ProbeEvent): void => {
  const stamped = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString()
  };
  appendFileSync(eventPathForHost(stamped.host), `${JSON.stringify(stamped)}\n`, "utf8");
};

const parseJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
};

const createCanaryServer = (): McpServer => {
  const widgetTemplate = readFileSync(
    path.resolve(process.cwd(), "public/plan1-canary-widget.html"),
    "utf8"
  );
  const widgetHtml = widgetTemplate
    .replaceAll("__PROBE_TELEMETRY_ENDPOINT__", `${TELEMETRY_BASE_URL}/probe-events`)
    .replaceAll("__PROBE_MARKER_TEXT__", MARKER_TEXT);

  const server = new McpServer({
    name: "plan1-ui-canary",
    version: "0.1.0"
  });

  registerAppResource(server, "plan1-canary-widget", CANARY_WIDGET_URI, {}, async () => ({
    contents: [
      {
        uri: CANARY_WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: true
          }
        }
      }
    ]
  }));

  registerAppTool(
    server,
    "probe_fetch_state",
    {
      title: "Plan1: fetch probe state",
      description: "Data tool for session bootstrap and host hints.",
      inputSchema: {
        sessionId: z.string().optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      },
      _meta: {}
    },
    async (args) => {
      const sessionId = args.sessionId ?? randomUUID();

      return {
        content: [
          {
            type: "text",
            text: `Probe session ${sessionId} initialized. Call probe_render_widget with this sessionId.`
          }
        ],
        structuredContent: {
          status: "ready",
          sessionId,
          hostHints: {
            expectedBridge: "ui/* JSON-RPC over postMessage",
            telemetryEndpoint: `${TELEMETRY_BASE_URL}/probe-events`,
            markerText: MARKER_TEXT
          }
        }
      };
    }
  );

  registerAppTool(
    server,
    "probe_render_widget",
    {
      title: "Plan1: render probe widget",
      description: "Render tool with MCP Apps UI metadata for bridge/iframe capability checks.",
      inputSchema: {
        sessionId: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      },
      _meta: {
        ui: {
          resourceUri: CANARY_WIDGET_URI
        },
        "openai/outputTemplate": CANARY_WIDGET_URI
      }
    },
    async (args) => {
      return {
        content: [
          {
            type: "text",
            text: `Attempting inline widget render for session ${args.sessionId}.`
          },
          {
            type: "text",
            text: `Expected marker: ${MARKER_TEXT}`
          }
        ],
        structuredContent: {
          status: "render_requested",
          sessionId: args.sessionId,
          markerText: MARKER_TEXT,
          telemetryEndpoint: `${TELEMETRY_BASE_URL}/probe-events`
        }
      };
    }
  );

  return server;
};

ensureArtifactFiles();

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/probe-events") {
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      const body = await parseJsonBody(req);
      const parsed = probeEventSchema.safeParse(body);

      if (!parsed.success) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            error: "Invalid probe event payload",
            issues: parsed.error.issues
          })
        );
        return;
      }

      appendEvent(parsed.data);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "plan1-ui-canary",
        mcpPath: MCP_PATH,
        telemetryEndpoint: `${TELEMETRY_BASE_URL}/probe-events`,
        markerText: MARKER_TEXT
      })
    );
    return;
  }

  const methods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && methods.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const appServer = createCanaryServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      appServer.close();
    });

    try {
      await appServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Plan1 MCP request failed:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

server.listen(PORT, () => {
  console.log(`[plan1-ui-canary] listening on http://localhost:${PORT}${MCP_PATH}`);
  console.log(
    `[plan1-ui-canary] telemetry endpoint ${TELEMETRY_BASE_URL}/probe-events`
  );
  console.log(`[plan1-ui-canary] marker ${MARKER_TEXT}`);
});
