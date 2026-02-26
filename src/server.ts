import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

import { searchOrFetchCatalog } from "./core/catalog.js";
import { resolveHostCapabilities } from "./core/host-mode.js";
import { buildFallbackHint, buildRenderToolMeta, WIDGET_URI } from "./core/tool-meta.js";

const PORT = Number(process.env.PORT ?? 8787);
const MCP_PATH = process.env.MCP_PATH ?? "/mcp";
const widgetHtml = readFileSync(
  path.resolve(process.cwd(), "public/catalog-widget.html"),
  "utf8"
);

const summarizeItems = (title: string, ids: string[]): string => {
  if (ids.length === 0) {
    return `${title}: no matches found.`;
  }
  return `${title}: ${ids.length} match(es): ${ids.join(", ")}.`;
};

const createCatalogServer = (): McpServer => {
  const hostCapabilities = resolveHostCapabilities();

  const server = new McpServer({
    name: "codex-apps-dual-mode-spike",
    version: "0.1.0"
  });

  registerAppResource(server, "catalog-widget", WIDGET_URI, {}, async () => ({
    contents: [
      {
        uri: WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: { prefersBorder: true }
        }
      }
    ]
  }));

  registerAppTool(
    server,
    "search_or_fetch_catalog",
    {
      title: "Search or fetch docs catalog entries",
      description:
        "Data tool. Fetch by IDs or search by query. Returns structured results and is safe for non-UI hosts.",
      inputSchema: {
        query: z.string().optional().describe("Free-text query over title/summary/tags/url."),
        ids: z
          .array(z.string())
          .optional()
          .describe("Direct IDs for deterministic fetch. Takes precedence over query."),
        limit: z.number().int().min(1).max(20).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      _meta: {}
    },
    async (args) => {
      const result = searchOrFetchCatalog({
        query: args.query,
        ids: args.ids,
        limit: args.limit
      });

      return {
        content: [
          {
            type: "text",
            text: summarizeItems("search_or_fetch_catalog", result.selectedIds)
          },
          {
            type: "text",
            text: buildFallbackHint(hostCapabilities.uiEnabled)
          }
        ],
        structuredContent: {
          strategy: result.strategy,
          totalMatches: result.totalMatches,
          selectedIds: result.selectedIds,
          items: result.items,
          host: {
            uiMode: hostCapabilities.uiMode,
            uiEnabled: hostCapabilities.uiEnabled,
            reason: hostCapabilities.reason
          },
          nextStep:
            "Call render_catalog_widget with selectedIds if you want host-rendered UI where supported."
        }
      };
    }
  );

  registerAppTool(
    server,
    "render_catalog_widget",
    {
      title: "Render docs catalog widget (optional UI host path)",
      description:
        "Render tool. Accepts IDs and returns the final payload for optional inline UI hosts. Also works in text-only mode.",
      inputSchema: {
        ids: z
          .array(z.string())
          .min(1)
          .max(20)
          .describe("IDs from search_or_fetch_catalog.selectedIds")
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      },
      _meta: buildRenderToolMeta(hostCapabilities.uiEnabled)
    },
    async (args) => {
      const result = searchOrFetchCatalog({ ids: args.ids, limit: args.ids.length });

      const content = [
        {
          type: "text" as const,
          text: summarizeItems("render_catalog_widget", result.selectedIds)
        },
        {
          type: "text" as const,
          text: buildFallbackHint(hostCapabilities.uiEnabled)
        }
      ];

      return {
        content,
        structuredContent: {
          items: result.items,
          selectedIds: result.selectedIds,
          host: {
            uiMode: hostCapabilities.uiMode,
            uiEnabled: hostCapabilities.uiEnabled,
            reason: hostCapabilities.reason
          }
        }
      };
    }
  );

  return server;
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "codex-apps-dual-mode-spike",
        mcpPath: MCP_PATH
      })
    );
    return;
  }

  const methods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && methods.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const appServer = createCatalogServer();
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
      console.error("MCP transport request failed:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

server.listen(PORT, () => {
  const hostCapabilities = resolveHostCapabilities();
  console.log(
    `[codex-apps-dual-mode-spike] listening on http://localhost:${PORT}${MCP_PATH}`
  );
  console.log(
    `[codex-apps-dual-mode-spike] uiEnabled=${hostCapabilities.uiEnabled} (${hostCapabilities.reason})`
  );
});
