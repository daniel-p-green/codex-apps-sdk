# Companion Host Runbook (Figma-First Embedded UI)

Status: operational runbook for local companion host usage.

For architecture details, data flow, and security model, use `docs/architecture-spec.md` as the source of truth.

## Scope Of This Document

Use this doc for:
- Starting and operating the companion host locally
- Calling the local host API endpoints
- Troubleshooting host/runtime behavior

Do not use this doc as the architecture source of truth.

## Runtime Components

1. Companion host server
- File: `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/apps/companion-host/src/server.ts`
- Responsibility: static UI hosting, local API endpoints, SSE stream

2. Codex relay
- File: `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/apps/codex-relay/src/codex-relay.ts`
- Responsibility: `codex app-server` JSON-RPC adapter and event enrichment

3. Frontend client
- Files:
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/apps/companion-host/public/index.html`
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/apps/companion-host/public/app.js`
  - `/Users/danielgreen/Documents/GitHub/codex-apps-sdk/apps/companion-host/public/styles.css`

## Quick Start

```bash
npm run dev:host
```

Open the host UI at the local URL configured by `HOST_PORT` (default in code: `8790`).

## API Surface

### Session + turn

- `POST /session/start`
```json
{ "model": "gpt-5.3-codex" }
```

- `POST /turn/start`
```json
{
  "sessionId": "sess_xxx",
  "text": "Generate a figjam diagram",
  "app": { "id": "connector_x", "name": "Figma", "slug": "figma" }
}
```

- `POST /turn/steer`
```json
{ "sessionId": "sess_xxx", "text": "Continue with tool output only." }
```

### Events

- `GET /events`
- Stream includes relay item events, turn events, and widget decisions.

### MCP metadata reads

- `POST /mcp/tool/read`
```json
{ "server": "codex_apps", "tool": "figma_generate_diagram" }
```

- `POST /mcp/resource/read`
```json
{ "server": "codex_apps", "uri": "ui://widget/figjam-diagram.html" }
```

- `POST /mcp/resourceTemplate/read`
```json
{ "server": "codex_apps", "uriTemplate": "ui://widget/{id}.html" }
```

### Bridge relay

- `POST /bridge/tools/call`
```json
{
  "sessionId": "sess_xxx",
  "toolName": "figma_generate_diagram",
  "arguments": { "name": "Flow", "mermaidSyntax": "flowchart LR; A-->B" },
  "appSlug": "figma"
}
```

## Troubleshooting

1. No apps listed
- Check Codex app-server status and app availability.
- Verify with `npm run apps:list` and `npm run apps:health`.

2. Widget does not render
- Confirm tool result contains template metadata.
- Check policy allow/block settings and fallback events in host output.

3. MCP metadata lookup fails
- Verify server name and URI.
- Retry via the compatibility aliases if testing older clients.
