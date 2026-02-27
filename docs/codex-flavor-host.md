# Codex Flavor Host (Figma-First Embedded UI)

This document describes the production-oriented custom host implementation added to this repo to support embedded Apps-style UI in a Codex flavor.

## What This Adds

1. **Custom host runtime over `codex app-server`**
- File: `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/src/codex-flavor-host.ts`
- Static web client + API + SSE event stream.

2. **App-server adapter with extended MCP read APIs**
- File: `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/src/host/app-server-gateway.ts`
- Adds adapter methods for:
  - `mcpServer/tool/read`
  - `mcpServer/resource/read`
  - `mcpServer/resourceTemplate/read`
- Includes compatibility fallback when native app-server methods are unavailable.

3. **Thread item enrichment**
- `item/started` and `item/completed` notifications are enriched for `mcpToolCall` items with:
  - `item.result.result_meta.tool_meta`
  - `item.result.result_meta.resolved_template_uri`
  - `item.result.result_meta.resolved_template_source`
  - `item.result.result_meta.ui_allowed`

4. **Figma-first inline render path**
- Browser client:
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/public/codex-flavor/index.html`
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/public/codex-flavor/app.js`
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/public/codex-flavor/styles.css`
- Resolves template URI using required precedence and mounts inline iframe widgets when possible.
- Falls back to readable tool output when template content is unavailable.

## API Surface (Host Adapter)

### GET `/api/health`
- Returns host policy and runtime state.

### GET `/api/models`
- Proxies `model/list`.

### GET `/api/apps?forceRefetch=<bool>`
- Proxies `app/list`.

### GET `/api/mcp/servers/status?forceRefresh=<bool>`
- Proxies and caches `mcpServerStatus/list`.

### POST `/api/thread/start`
Body:
```json
{ "model": "gpt-5.3-codex" }
```

### POST `/api/turn/start`
Body:
```json
{
  "threadId": "thr_xxx",
  "text": "Generate a figjam diagram",
  "app": { "id": "connector_x", "name": "Figma", "slug": "figma" }
}
```

### POST `/api/turn/steer`
Body:
```json
{ "threadId": "thr_xxx", "text": "Continue with tool output only." }
```

### POST `/api/mcpServer/tool/read`
Body:
```json
{ "server": "codex_apps", "tool": "figma_generate_diagram" }
```

### POST `/api/mcpServer/resource/read`
Body:
```json
{ "server": "codex_apps", "uri": "ui://widget/figjam-diagram.html" }
```

### POST `/api/mcpServer/resourceTemplate/read`
Body:
```json
{ "server": "codex_apps", "uriTemplate": "ui://widget/{id}.html" }
```

### POST `/api/bridge/tools/call`
Body:
```json
{
  "threadId": "thr_xxx",
  "toolName": "figma_generate_diagram",
  "arguments": { "name": "Flow", "mermaidSyntax": "flowchart LR; A-->B" },
  "appSlug": "figma"
}
```

Relay mode:
- Uses app-server turn flow (`turn/steer`) to request tool invocation.

### GET `/api/events`
- Server-sent events for app-server notifications (enriched item payloads).

## Template URI Resolution Contract

Implemented in:
- `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/src/host/widget-resolution.ts`

Precedence:
1. `result_meta.ui.resourceUri`
2. `result_meta["openai/outputTemplate"]`
3. `tool_meta.ui.resourceUri`
4. `tool_meta["openai/outputTemplate"]`

## Embedded UI Policy Controls

Environment variables:
- `EMBEDDED_UI_ENABLED` (`true` by default)
- `EMBEDDED_UI_ALLOWED_APPS` (comma-separated)
- `EMBEDDED_UI_BLOCKED_APPS` (comma-separated)

Implementation:
- `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/src/host/ui-policy.ts`

## Notes on Current Platform Gaps

When native app-server resource-read methods are not available, the adapter falls back to MCP status cache metadata for continuity. This preserves flow and keeps fallback behavior deterministic while still enabling inline rendering when resource HTML is obtainable.
