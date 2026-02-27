import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { CodexAppServerGateway } from "./host/app-server-gateway.js";
import { createUiRenderPolicy } from "./host/ui-policy.js";

type JsonObject = Record<string, unknown>;

const HOST_PORT = Number(process.env.HOST_PORT ?? 8790);
const PUBLIC_ROOT = path.resolve(process.cwd(), "public/codex-flavor");

const uiPolicy = createUiRenderPolicy();
const gateway = new CodexAppServerGateway(uiPolicy);
const sseClients = new Set<ServerResponse>();

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

gateway.subscribe((message) => {
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

const handleApi = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> => {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "codex-flavor-host",
      uiPolicy: {
        enabled: uiPolicy.enabled,
        allowedApps: uiPolicy.allowedApps ? Array.from(uiPolicy.allowedApps) : null,
        blockedApps: Array.from(uiPolicy.blockedApps)
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
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
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/models") {
    const models = await gateway.listModels(100);
    sendJson(res, 200, {
      ok: true,
      data: models
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/apps") {
    const forceRefetch = url.searchParams.get("forceRefetch") === "true";
    const apps = await gateway.listApps(forceRefetch, 200);
    sendJson(res, 200, {
      ok: true,
      data: apps
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/mcp/servers/status") {
    const forceRefresh = url.searchParams.get("forceRefresh") === "true";
    const data = await gateway.listMcpServerStatus(forceRefresh);
    sendJson(res, 200, {
      ok: true,
      data
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/thread/start") {
    const body = await parseJsonBody(req);
    const model = asString(body.model);
    const result = await gateway.startThread(model ?? undefined);
    sendJson(res, 200, {
      ok: true,
      threadId: result.threadId
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/turn/start") {
    const body = await parseJsonBody(req);
    const threadId = asString(body.threadId);
    const text = asString(body.text);
    const app = isRecord(body.app) ? body.app : null;

    if (!threadId || !text) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId and text are required."
      });
      return;
    }

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

    await gateway.startTurn(threadId, input);
    sendJson(res, 200, {
      ok: true
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/turn/steer") {
    const body = await parseJsonBody(req);
    const threadId = asString(body.threadId);
    const text = asString(body.text);
    if (!threadId || !text) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId and text are required."
      });
      return;
    }
    await gateway.steerTurn(threadId, [{ type: "text", text }]);
    sendJson(res, 200, {
      ok: true
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bridge/tools/call") {
    const body = await parseJsonBody(req);
    const threadId = asString(body.threadId);
    const toolName = asString(body.toolName);
    const appSlug = asString(body.appSlug);

    if (!threadId || !toolName) {
      sendJson(res, 400, {
        ok: false,
        error: "threadId and toolName are required."
      });
      return;
    }

    await gateway.relayToolsCallViaTurnFlow(threadId, toolName, body.arguments, appSlug);
    sendJson(res, 200, {
      ok: true,
      mode: "turn_flow_relay"
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/mcpServer/tool/read") {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const tool = asString(body.tool);
    if (!server || !tool) {
      sendJson(res, 400, {
        ok: false,
        error: "server and tool are required."
      });
      return;
    }

    const descriptor = await gateway.readTool(server, tool);
    sendJson(res, descriptor ? 200 : 404, {
      ok: Boolean(descriptor),
      descriptor,
      error: descriptor ? null : `Tool "${tool}" not found on server "${server}".`
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/mcpServer/resource/read") {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const uri = asString(body.uri);
    if (!server || !uri) {
      sendJson(res, 400, {
        ok: false,
        error: "server and uri are required."
      });
      return;
    }

    const result = await gateway.readResource(server, uri);
    sendJson(res, 200, {
      ok: result.error === null,
      ...result
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/mcpServer/resourceTemplate/read") {
    const body = await parseJsonBody(req);
    const server = asString(body.server);
    const uriTemplate = asString(body.uriTemplate);
    if (!server || !uriTemplate) {
      sendJson(res, 400, {
        ok: false,
        error: "server and uriTemplate are required."
      });
      return;
    }
    const result = await gateway.readResourceTemplate(server, uriTemplate);
    sendJson(res, 200, {
      ok: result.error === null,
      ...result
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/telemetry") {
    const body = await parseJsonBody(req);
    console.log("[codex-flavor-host][telemetry]", JSON.stringify(body));
    sendJson(res, 200, {
      ok: true
    });
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: "Not found"
  });
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

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
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
  await gateway.listMcpServerStatus(true).catch(() => {
    // Startup should not fail if status prefetch fails.
  });
  console.log(`[codex-flavor-host] listening on http://localhost:${HOST_PORT}`);
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
  await gateway.close();
  server.close();
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
