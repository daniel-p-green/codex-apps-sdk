import { spawn, type ChildProcessByStdio } from "node:child_process";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";

import { extractTrustedFigmaUrl, isFigmaRenderCapableTool } from "../../../packages/app-adapters/figma/src/index.js";
import type { JsonObject, ToolMetaShape } from "../../../packages/protocol/src/index.js";
import { resolveTemplateUri } from "../../../packages/widget-runtime/src/template-resolution.js";
import { isUiRenderAllowed, type UiRenderPolicy } from "../../../packages/widget-runtime/src/ui-policy.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

type NotificationListener = (message: JsonObject) => void;

interface McpServerStatusSnapshot {
  name: string;
  tools: Record<string, JsonObject>;
  resources: JsonObject[];
  resourceTemplates: JsonObject[];
}

interface PagedResponse<T> {
  data?: T[];
  nextCursor?: string | null;
}

export interface StartThreadResult {
  threadId: string;
}

export interface ResourceSecurityPolicy {
  widgetDomain: string | null;
  connectDomains: string[];
  resourceDomains: string[];
  frameDomains: string[];
}

export interface ResourceReadResult {
  server: string;
  uri: string;
  source: "app_server_rpc" | "status_cache" | "unavailable";
  resource: JsonObject | null;
  contents: JsonObject[];
  security: ResourceSecurityPolicy;
  error: string | null;
}

export interface ResourceTemplateReadResult {
  server: string;
  uriTemplate: string;
  source: "app_server_rpc" | "status_cache" | "unavailable";
  template: JsonObject | null;
  error: string | null;
}

const REQUEST_TIMEOUT_MS = 20_000;
const REFRESH_INTERVAL_MS = 60_000;

const isRecord = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asString(item))
    .filter((item): item is string => item !== null);
};

const toStatusSnapshot = (input: JsonObject): McpServerStatusSnapshot | null => {
  const name = asString(input.name);
  if (!name) {
    return null;
  }

  const toolsRaw = isRecord(input.tools) ? input.tools : {};
  const tools: Record<string, JsonObject> = {};
  for (const [toolName, descriptor] of Object.entries(toolsRaw)) {
    if (isRecord(descriptor)) {
      tools[toolName] = descriptor;
    }
  }

  const resources = Array.isArray(input.resources)
    ? input.resources.filter((item): item is JsonObject => isRecord(item))
    : [];
  const resourceTemplates = Array.isArray(input.resourceTemplates)
    ? input.resourceTemplates.filter((item): item is JsonObject => isRecord(item))
    : Array.isArray(input.resource_templates)
      ? input.resource_templates.filter((item): item is JsonObject => isRecord(item))
      : [];

  return {
    name,
    tools,
    resources,
    resourceTemplates
  };
};

const mergeSecurityPolicy = (resource: JsonObject | null): ResourceSecurityPolicy => {
  const metaCandidate = resource?._meta ?? resource?.meta;
  const meta = isRecord(metaCandidate) ? metaCandidate : {};

  const widgetCspCandidate = meta["openai/widgetCSP"];
  const widgetCsp = isRecord(widgetCspCandidate) ? widgetCspCandidate : {};

  return {
    widgetDomain: asString(meta["openai/widgetDomain"]),
    connectDomains: toStringArray(widgetCsp.connect_domains),
    resourceDomains: toStringArray(widgetCsp.resource_domains),
    frameDomains: toStringArray(widgetCsp.frame_domains)
  };
};

const getToolMeta = (tool: JsonObject | null): ToolMetaShape | null => {
  if (!tool) {
    return null;
  }
  const meta = tool._meta ?? tool.meta;
  return isRecord(meta) ? (meta as ToolMetaShape) : null;
};

export class CodexRelay {
  private readonly process: ChildProcessByStdio<Writable, Readable, null>;
  private readonly reader: readline.Interface;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<NotificationListener>();
  private readonly mcpStatusCache = new Map<string, McpServerStatusSnapshot>();

  private requestId = 0;
  private initialized = false;
  private closed = false;
  private lastMcpRefreshAt = 0;

  constructor(private readonly uiPolicy: UiRenderPolicy) {
    this.process = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "inherit"]
    });
    this.reader = readline.createInterface({ input: this.process.stdout });
    this.reader.on("line", (line) => this.onLine(line));
    this.process.on("exit", (code, signal) => this.onProcessExit(code, signal));
  }

  private onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.closed) {
      return;
    }
    const reason = `codex app-server exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private onLine(line: string): void {
    let message: JsonObject;
    try {
      message = JSON.parse(line) as JsonObject;
    } catch {
      return;
    }

    const id = message.id;
    if (typeof id === "number") {
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      clearTimeout(pending.timeout);

      if (isRecord(message.error)) {
        const code = message.error.code;
        const detail = asString(message.error.message) ?? "Unknown error";
        pending.reject(new Error(`JSON-RPC ${String(code ?? "unknown")}: ${detail}`));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    this.emit(this.enrichNotification(message));
  }

  private emit(message: JsonObject): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  private send(payload: JsonObject): void {
    this.process.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private async request(
    method: string,
    params: JsonObject = {},
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    const id = ++this.requestId;
    const payload = { method, id, params };

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for ${method} response.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.send(payload);
    });
  }

  private notify(method: string, params: JsonObject = {}): void {
    this.send({ method, params });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.request("initialize", {
      clientInfo: {
        name: "codex-flavor-host",
        title: "Codex Flavor Host",
        version: "1.0.0"
      }
    });
    this.notify("initialized", {});
    this.initialized = true;
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async listModels(limit = 50): Promise<JsonObject[]> {
    await this.ensureInitialized();
    const result = (await this.request("model/list", {
      limit,
      includeHidden: false
    })) as PagedResponse<JsonObject>;
    return Array.isArray(result.data) ? result.data : [];
  }

  async listApps(forceRefetch = false, limit = 100): Promise<JsonObject[]> {
    await this.ensureInitialized();
    const result = (await this.request("app/list", {
      cursor: null,
      limit,
      forceRefetch
    })) as PagedResponse<JsonObject>;
    return Array.isArray(result.data) ? result.data : [];
  }

  async startThread(model?: string): Promise<StartThreadResult> {
    await this.ensureInitialized();
    const result = (await this.request("thread/start", {
      ...(model ? { model } : {})
    })) as JsonObject;
    const thread = isRecord(result.thread) ? result.thread : null;
    const threadId = asString(thread?.id);
    if (!threadId) {
      throw new Error("thread/start did not return thread.id");
    }
    return { threadId };
  }

  async startTurn(threadId: string, input: JsonObject[]): Promise<void> {
    await this.ensureInitialized();
    await this.request("turn/start", {
      threadId,
      input
    });
  }

  async steerTurn(threadId: string, input: JsonObject[]): Promise<void> {
    await this.ensureInitialized();
    await this.request("turn/steer", {
      threadId,
      input
    });
  }

  async relayToolsCallViaTurnFlow(
    threadId: string,
    toolName: string,
    args: unknown,
    appSlug?: string | null
  ): Promise<void> {
    const serializedArgs = JSON.stringify(args ?? {});
    const mentionPrefix = appSlug ? `$${appSlug} ` : "";
    const text =
      `${mentionPrefix}Call tool "${toolName}" with arguments ${serializedArgs}. ` +
      "Return the raw tool result with minimal additional narration.";
    await this.steerTurn(threadId, [{ type: "text", text }]);
  }

  async listMcpServerStatus(forceRefresh = false): Promise<McpServerStatusSnapshot[]> {
    await this.ensureInitialized();

    const shouldRefresh =
      forceRefresh ||
      this.mcpStatusCache.size === 0 ||
      Date.now() - this.lastMcpRefreshAt > REFRESH_INTERVAL_MS;

    if (shouldRefresh) {
      const snapshots: McpServerStatusSnapshot[] = [];
      let cursor: string | null = null;
      do {
        const page = (await this.request("mcpServerStatus/list", {
          cursor,
          limit: 100
        })) as PagedResponse<JsonObject>;

        const rows = Array.isArray(page.data) ? page.data : [];
        for (const row of rows) {
          const snapshot = toStatusSnapshot(row);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
        cursor = asString(page.nextCursor) ?? null;
      } while (cursor);

      this.mcpStatusCache.clear();
      for (const snapshot of snapshots) {
        this.mcpStatusCache.set(snapshot.name, snapshot);
      }
      this.lastMcpRefreshAt = Date.now();
    }

    return Array.from(this.mcpStatusCache.values());
  }

  private getToolDescriptor(
    server: string,
    tool: string
  ): {
    descriptor: JsonObject | null;
    toolMeta: ToolMetaShape | null;
  } {
    const snapshot = this.mcpStatusCache.get(server);
    const descriptor = snapshot?.tools?.[tool] ?? null;
    return {
      descriptor,
      toolMeta: getToolMeta(descriptor)
    };
  }

  async readTool(server: string, tool: string): Promise<JsonObject | null> {
    await this.listMcpServerStatus();
    const snapshot = this.mcpStatusCache.get(server);
    return snapshot?.tools?.[tool] ?? null;
  }

  private async tryRpcResourceRead(server: string, uri: string): Promise<unknown | null> {
    const attempts: Array<{ method: string; params: JsonObject }> = [
      { method: "mcpServer/resource/read", params: { serverName: server, uri } },
      { method: "mcpServer/resource/read", params: { name: server, uri } },
      { method: "mcpServer/resource/read", params: { server, uri } },
      { method: "mcpServer/resources/read", params: { serverName: server, uri } }
    ];

    for (const attempt of attempts) {
      try {
        return await this.request(attempt.method, attempt.params, 10_000);
      } catch {
        // Ignore and continue through fallback attempts.
      }
    }

    return null;
  }

  async readResource(server: string, uri: string): Promise<ResourceReadResult> {
    await this.listMcpServerStatus();

    const rpcResult = await this.tryRpcResourceRead(server, uri);
    if (isRecord(rpcResult)) {
      const resourceCandidate = isRecord(rpcResult.resource) ? rpcResult.resource : null;
      const contents = Array.isArray(rpcResult.contents)
        ? rpcResult.contents.filter((item): item is JsonObject => isRecord(item))
        : [];

      return {
        server,
        uri,
        source: "app_server_rpc",
        resource: resourceCandidate,
        contents,
        security: mergeSecurityPolicy(resourceCandidate),
        error: null
      };
    }

    const snapshot = this.mcpStatusCache.get(server);
    const resource =
      snapshot?.resources.find((entry) => asString(entry.uri) === uri) ?? null;
    if (resource) {
      return {
        server,
        uri,
        source: "status_cache",
        resource,
        contents: [],
        security: mergeSecurityPolicy(resource),
        error: null
      };
    }

    return {
      server,
      uri,
      source: "unavailable",
      resource: null,
      contents: [],
      security: mergeSecurityPolicy(null),
      error: `Resource "${uri}" was not found for MCP server "${server}".`
    };
  }

  private async tryRpcResourceTemplateRead(
    server: string,
    uriTemplate: string
  ): Promise<unknown | null> {
    const attempts: Array<{ method: string; params: JsonObject }> = [
      {
        method: "mcpServer/resourceTemplate/read",
        params: { serverName: server, uriTemplate }
      },
      { method: "mcpServer/resourceTemplate/read", params: { name: server, uriTemplate } },
      { method: "mcpServer/resourceTemplate/read", params: { server, uriTemplate } }
    ];

    for (const attempt of attempts) {
      try {
        return await this.request(attempt.method, attempt.params, 10_000);
      } catch {
        // Continue fallback flow.
      }
    }

    return null;
  }

  async readResourceTemplate(
    server: string,
    uriTemplate: string
  ): Promise<ResourceTemplateReadResult> {
    await this.listMcpServerStatus();

    const rpcResult = await this.tryRpcResourceTemplateRead(server, uriTemplate);
    if (isRecord(rpcResult)) {
      const template = isRecord(rpcResult.template)
        ? rpcResult.template
        : isRecord(rpcResult.resourceTemplate)
          ? rpcResult.resourceTemplate
          : null;
      return {
        server,
        uriTemplate,
        source: "app_server_rpc",
        template,
        error: null
      };
    }

    const snapshot = this.mcpStatusCache.get(server);
    const template =
      snapshot?.resourceTemplates.find(
        (entry) =>
          asString(entry.uriTemplate) === uriTemplate ||
          asString(entry.uri_template) === uriTemplate
      ) ?? null;

    if (template) {
      return {
        server,
        uriTemplate,
        source: "status_cache",
        template,
        error: null
      };
    }

    return {
      server,
      uriTemplate,
      source: "unavailable",
      template: null,
      error: `Resource template "${uriTemplate}" was not found for MCP server "${server}".`
    };
  }

  private enrichMcpToolCallItem(item: JsonObject): JsonObject {
    const type = asString(item.type);
    if (type !== "mcpToolCall") {
      return item;
    }

    const server = asString(item.server);
    const tool = asString(item.tool);
    if (!server || !tool) {
      return item;
    }

    const { descriptor, toolMeta } = this.getToolDescriptor(server, tool);
    if (!descriptor) {
      return item;
    }

    const connectorName = asString(toolMeta?.connector_name);
    const connectorId = asString(toolMeta?.connector_id);
    const uiAllowed = isUiRenderAllowed(this.uiPolicy, connectorName, connectorId);

    const result = isRecord(item.result) ? { ...item.result } : null;
    const existingResultMeta = isRecord(result?.result_meta) ? result.result_meta : {};
    const resolvedTemplate = resolveTemplateUri({
      resultMeta: existingResultMeta,
      toolMeta
    });
    const figmaRenderCapable = isFigmaRenderCapableTool(server, tool);
    const figmaPreviewUrl = extractTrustedFigmaUrl(result);

    const resolvedMeta: JsonObject = {
      ...existingResultMeta,
      tool_meta: toolMeta,
      "openai/outputTemplate": toolMeta?.["openai/outputTemplate"] ?? null,
      ui: isRecord(toolMeta?.ui) ? toolMeta?.ui : null,
      connector_name: connectorName,
      connector_id: connectorId,
      resolved_template_uri: resolvedTemplate.uri,
      resolved_template_source: resolvedTemplate.source,
      ui_allowed: uiAllowed,
      figma: {
        renderCapable: figmaRenderCapable,
        trustedPreviewUrl: figmaPreviewUrl
      }
    };

    if (result) {
      result.result_meta = resolvedMeta;
    }

    return {
      ...item,
      result,
      tool_meta: toolMeta
    };
  }

  private enrichNotification(message: JsonObject): JsonObject {
    const method = asString(message.method);
    if (!method) {
      return message;
    }

    const params = isRecord(message.params) ? { ...message.params } : null;
    if (!params) {
      return message;
    }

    if (method === "item/completed" || method === "item/started") {
      const item = isRecord(params.item) ? params.item : null;
      if (item) {
        params.item = this.enrichMcpToolCallItem(item);
        return {
          ...message,
          params
        };
      }
    }

    return message;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.reader.close();
    this.process.stdin.end();
    this.process.kill("SIGTERM");
  }
}

export { CodexRelay as CodexAppServerGateway };
