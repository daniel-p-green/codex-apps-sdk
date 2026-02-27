import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CodexRelay } from "../../codex-relay/src/codex-relay.js";
import { createConsoleTelemetrySink, emitTelemetry } from "../../../packages/telemetry/src/index.js";
import { createUiRenderPolicy } from "../../../packages/widget-runtime/src/ui-policy.js";

type JsonObject = Record<string, unknown>;

interface SessionState {
  model: string | null;
  threadId: string;
}

const HOST_PORT = Number(process.env.HOST_PORT ?? 8790);
const PUBLIC_ROOT = fileURLToPath(new URL("../public", import.meta.url));

const uiPolicy = createUiRenderPolicy();
const relay = new CodexRelay(uiPolicy);
const telemetry = createConsoleTelemetrySink("companion-host");
const sseClients = new Set<ServerResponse>();
const sessions = new Map<string, SessionState>();

const MIME_BY_EXT = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

const isRecord = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
};

const parseJsonBody = async (req: IncomingMessage): Promise<JsonObject> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("JSON body must be an object.");
  }
  return parsed;
};

const broadcastEvent = (message: JsonObject): void => {
  const frame = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
};

relay.subscribe((message) => {
  broadcastEvent(message);
});

const serveStaticFile = async (urlPath: string, res: ServerResponse): Promise<boolean> => {
  const relativePath = urlPath === "/" ? "/index.html" : urlPath;
  const safePath = path
    .normalize(relativePath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^\//, "");
  const filePath = path.join(PUBLIC_ROOT, safePath);

  if (!filePath.startsWith(PUBLIC_ROOT)) {
    return false;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_BY_EXT.get(ext) ?? "application/octet-stream";
    res.writeHead(200, {
      "content-type": mimeType,
      "cache-control": "no-store"
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
};

const resolveThreadId = (body: JsonObject): string | null => {
  const directThreadId = asString(body.threadId);
  if (directThreadId) {
    return directThreadId;
  }

  const sessionId = asString(body.sessionId);
  if (!sessionId) {
    return null;
  }

  return sessions.get(sessionId)?.threadId ?? null;
};

const startSession = async (model: string | null): Promise<{
  model: string | null;
  sessionId: string;
  threadId: string;
}> => {
  const started = await relay.startThread(model ?? undefined);
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    model,
    threadId: started.threadId
  });
  emitTelemetry(telemetry, "session_started", {
    model,
    sessionId,
    threadId: started.threadId
  });
  return {
    sessionId,
    threadId: started.threadId,
    model
  };
};

const withMention = (text: string, app: JsonObject | null): JsonObject[] => {
  const appSlug = asString(app?.slug);
  const appName = asString(app?.name);
  const appId = asString(app?.id);

  const input: JsonObject[] = [
    {
      type: "text",
      text: appSlug && !text.startsWith("$") ? `$${appSlug} ${text}` : text
    }
  ];

  if (appId) {
    input.push({
      type: "mention",
      ...(appName ? { name: appName } : {}),
      path: `app://${appId}`
    });
  }

  return input;
};

const isPath = (urlPath: string, ...accepted: string[]): boolean => accepted.includes(urlPath);

const handleApi = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
  if (req.method === "GET" && isPath(url.pathname, "/events", "/api/events")) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    res.write("event: ready\ndata: {}\n\n");
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
    return true;
  }

  if (req.method === "GET" && isPath(url.pathname, "/api/health")) {
    sendJson(res, 200, {
      ok: true,
      service: "companion-host",
      relay: "codex-app-server",
      uiPolicy: {
        enabled: uiPolicy.enabled,
        allowedApps: uiPolicy.allowedApps ? Array.from(uiPolicy.allowedApps) : null,
        blockedApps: Array.from(uiPolicy.blockedApps)
      }
    });
    return true;
  }

  if (req.method === "GET" && isPath(url.pathname, "/api/models")) {
    const models = await relay.listModels(100);
    sendJson(res, 200, {
      ok: true,
      data: models
    });
    return true;
  }

  if (req.method === "GET" && isPath(url.pathname, "/api/apps")) {
    const forceRefetch = url.searchParams.get("forceRefetch") === "true";
    const apps = await relay.listApps(forceRefetch, 200);
    sendJson(res, 200, {
      ok: true,
      data: apps
    });
    return true;
  }

  if (req.method === "GET" && isPath(url.pathname, "/api/mcp/servers/status")) {
    const forceRefresh = url.searchParams.get("forceRefresh") === "true";
    const data = await relay.listMcpServerStatus(forceRefresh);
    sendJson(res, 200, {
      ok: true,
      data
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/session/start", "/api/session/start")) {
    const body = await parseJsonBody(req);
    const model = asString(body.model);
    const started = await startSession(model ?? null);
    sendJson(res, 200, {
      ok: true,
      ...started
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/api/thread/start")) {
    const body = await parseJsonBody(req);
    const model = asString(body.model);
    const started = await startSession(model ?? null);
    sendJson(res, 200, {
      ok: true,
      threadId: started.threadId,
      sessionId: started.sessionId
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/turn/start", "/api/turn/start")) {
    const body = await parseJsonBody(req);
    const threadId = resolveThreadId(body);
    const text = asString(body.text);
    const app = isRecord(body.app) ? body.app : null;

    if (!threadId || !text) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId/sessionId and text are required."
      });
      return true;
    }

    const input = withMention(text, app);
    await relay.startTurn(threadId, input);

    const turnId = randomUUID();
    emitTelemetry(telemetry, "turn_started", {
      turnId,
      threadId
    });

    sendJson(res, 200, {
      ok: true,
      accepted: true,
      turnId
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/api/turn/steer")) {
    const body = await parseJsonBody(req);
    const threadId = resolveThreadId(body);
    const text = asString(body.text);
    if (!threadId || !text) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId/sessionId and text are required."
      });
      return true;
    }
    await relay.steerTurn(threadId, [{ type: "text", text }]);
    sendJson(res, 200, {
      ok: true,
      accepted: true,
      turnId: randomUUID()
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/bridge/tools/call", "/api/bridge/tools/call")) {
    const body = await parseJsonBody(req);
    const threadId = resolveThreadId(body);
    const toolName = asString(body.toolName);
    const appSlug = asString(body.appSlug);

    if (!threadId || !toolName) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId/sessionId and toolName are required."
      });
      return true;
    }

    await relay.relayToolsCallViaTurnFlow(threadId, toolName, body.arguments, appSlug);
    sendJson(res, 200, {
      ok: true,
      mode: "turn_flow_relay"
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/mcp/tool/read", "/api/mcp/tool/read", "/api/mcpServer/tool/read")) {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const tool = asString(body.tool);
    if (!server || !tool) {
      sendJson(res, 400, {
        ok: false,
        error: "server and tool are required."
      });
      return true;
    }

    const descriptor = await relay.readTool(server, tool);
    sendJson(res, descriptor ? 200 : 404, {
      ok: Boolean(descriptor),
      descriptor,
      error: descriptor ? null : `Tool "${tool}" not found on server "${server}".`
    });
    return true;
  }

  if (
    req.method === "POST" &&
    isPath(url.pathname, "/mcp/resource/read", "/api/mcp/resource/read", "/api/mcpServer/resource/read")
  ) {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const uri = asString(body.uri);
    if (!server || !uri) {
      sendJson(res, 400, {
        ok: false,
        error: "server and uri are required."
      });
      return true;
    }

    const result = await relay.readResource(server, uri);
    sendJson(res, 200, {
      ok: result.error === null,
      ...result
    });
    return true;
  }

  if (
    req.method === "POST" &&
    isPath(
      url.pathname,
      "/mcp/resourceTemplate/read",
      "/api/mcp/resourceTemplate/read",
      "/api/mcpServer/resourceTemplate/read"
    )
  ) {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const uriTemplate = asString(body.uriTemplate);
    if (!server || !uriTemplate) {
      sendJson(res, 400, {
        ok: false,
        error: "server and uriTemplate are required."
      });
      return true;
    }

    const result = await relay.readResourceTemplate(server, uriTemplate);
    sendJson(res, 200, {
      ok: result.error === null,
      ...result
    });
    return true;
  }

  if (req.method === "POST" && isPath(url.pathname, "/api/telemetry")) {
    const body = await parseJsonBody(req);
    emitTelemetry(telemetry, "client_event", body);
    sendJson(res, 200, {
      ok: true
    });
    return true;
  }

  return false;
};

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, {
        ok: false,
        error: "Missing URL"
      });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    const handled = await handleApi(req, res, url);
    if (handled) {
      return;
    }

    const served = await serveStaticFile(url.pathname, res);
    if (!served) {
      sendJson(res, 404, {
        ok: false,
        error: "Not found"
      });
    }
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const heartbeat = setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(": keep-alive\n\n");
    } catch {
      sseClients.delete(client);
    }
  }
}, 15_000);

server.listen(HOST_PORT, async () => {
  await relay.listMcpServerStatus(true).catch(() => {
    // Startup should not fail if status prefetch fails.
  });
  console.log(`[companion-host] listening on http://localhost:${HOST_PORT}`);
});

const shutdown = async () => {
  clearInterval(heartbeat);
  for (const client of sseClients) {
    try {
      client.end();
    } catch {
      // Ignore close errors.
    }
  }
  await relay.close();
  server.close();
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
