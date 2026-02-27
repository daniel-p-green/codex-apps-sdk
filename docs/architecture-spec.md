# Architecture Spec: Codex Mac + Companion Embedded Apps (Figma First)

## Overview

The runtime is split into two independently replaceable layers:

1. **Companion Host (`apps/companion-host`)**
- Local web UI pane for timeline, widget rendering, and bridge runtime.
- Exposes local HTTP + SSE API used by the browser client.

2. **Codex Relay (`apps/codex-relay`)**
- JSON-RPC adapter over `codex app-server`.
- Normalizes app/tool events and enriches MCP tool call results.

Shared logic is centralized in packages so we can replace only the host adapter in the future if native stock Codex embed becomes available.

## Repo Layout

1. `apps/companion-host`
- `src/server.ts`: local API + SSE server + static host
- `public/*`: companion pane frontend

2. `apps/codex-relay`
- `src/codex-relay.ts`: app-server client, status cache, enrichment

3. `packages/protocol`
- Shared interfaces for relay responses, widget decisions, bridge requests

4. `packages/widget-runtime`
- Template URI resolution precedence
- Embedded UI policy allow/block logic
- Bridge request/origin validation helpers

5. `packages/app-adapters/figma`
- Figma render-capable tool detection
- Trusted Figma URL extraction

6. `packages/telemetry`
- Structured telemetry sink + event emitter

## Relay API (Local)

Primary endpoints:

- `POST /session/start` -> `{ sessionId, threadId, model }`
- `POST /turn/start` -> `{ accepted: true, turnId }`
- `GET /events` (SSE)
- `POST /mcp/tool/read`
- `POST /mcp/resource/read`
- `POST /mcp/resourceTemplate/read`
- `POST /bridge/tools/call`

Compatibility aliases are still supported under `/api/*` and `mcpServer/*` paths.

## Event Enrichment

`mcpToolCall` items are enriched with:

- `result_meta.tool_meta`
- `result_meta.resolved_template_uri`
- `result_meta.resolved_template_source`
- `result_meta.ui_allowed`
- `result_meta.figma.renderCapable`
- `result_meta.figma.trustedPreviewUrl`

## Widget Resolution Rules

Precedence:

1. `result_meta.ui.resourceUri`
2. `result_meta["openai/outputTemplate"]`
3. `tool_meta.ui.resourceUri`
4. `tool_meta["openai/outputTemplate"]`

Resource read fallback order:

1. `item.server`
2. `codex_apps`

## Security Model

- No stock Codex client internals are modified.
- Third-party app content renders in sandboxed iframes.
- Bridge requests are constrained to `ui/initialize`, `ui/update-model-context`, and `tools/call`.
- App-level and global embedded UI kill switches are enforced before render.

## Failure Behavior

- Missing/unreadable template URI does not break turn flow.
- Companion host falls back to structured tool output cards.
- Figma URLs are shown only when they pass trusted host checks.

## Migration Path

To migrate to future native in-stock embed support:

1. Keep `packages/protocol` and `packages/widget-runtime` unchanged.
2. Replace only the host adapter (`apps/companion-host`) with a native Codex host integration.
3. Reuse relay enrichment, bridge contracts, and policy controls.
