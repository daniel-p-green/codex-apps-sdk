# Architecture Spec: Dual-Mode Apps SDK + Codex Connector Integration

## Overview

This spike implements a single MCP backend with host-dependent presentation behavior:

- Tool-first baseline for Codex and any non-UI host.
- Optional render-tool metadata for hosts with MCP Apps UI support.

## Components

1. `src/server.ts`
- Streamable HTTP MCP endpoint (`/mcp`).
- Registers one data tool and one render tool.
- Registers a widget resource (`ui://widget/catalog.html`).

2. Data and mode core
- `src/core/catalog.ts`: deterministic search/fetch behavior.
- `src/core/host-mode.ts`: host capability resolution (`UI_MODE`, `HOST_SUPPORTS_MCP_APPS_UI`).
- `src/core/tool-meta.ts`: render-tool metadata gating.

3. UI resource
- `public/catalog-widget.html`: receives tool-result notifications when host bridge is available and gracefully degrades when not.

4. Operational scripts
- `scripts/codex-app-list.ts`: app discovery via `codex app-server` RPC `app/list`.
- `scripts/codex-app-health.ts`: local readiness checks.
- `scripts/validate-matrix.ts`: local compatibility assertions.

5. Skill/plugin wrappers
- Skill: `skills/codex-inline-apps/SKILL.md`.
- Commands: `commands/apps-discover.md`, `commands/apps-health.md`.

## Public Tool Interfaces

### `search_or_fetch_catalog`

Input:
- `query?: string`
- `ids?: string[]`
- `limit?: number (1..20)`

Output:
- `content[]` text summary
- `structuredContent.strategy`
- `structuredContent.totalMatches`
- `structuredContent.selectedIds`
- `structuredContent.items[]`
- `structuredContent.host.{uiMode, uiEnabled, reason}`

### `render_catalog_widget`

Input:
- `ids: string[] (1..20)`

Output:
- `content[]` text summary + fallback hint
- `structuredContent.items[]`
- `structuredContent.host.{uiMode, uiEnabled, reason}`
- `_meta.ui.resourceUri` + `_meta["openai/outputTemplate"]` only when UI enabled

## Host Capability Rules

- `UI_MODE=chatgpt`: force UI metadata on render tool.
- `UI_MODE=off`: force tool-only fallback.
- `UI_MODE=auto` (default): UI disabled unless `HOST_SUPPORTS_MCP_APPS_UI=true`.

## Failure Behavior

- Missing UI bridge does not fail tool flow.
- Render tool still returns text + structured data in fallback mode.
- Health endpoint (`/health`) remains available for local validation.
