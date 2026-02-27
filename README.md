# Codex Companion Embedded Apps (Figma First)

Companion-host architecture for Codex workflows: keep stock Codex app mentions + tool calls, and render app widgets in a synchronized companion UI when widget templates are available.

## Why This Exists

- Codex app/connectors flow works today via `app/list`, `$<app-slug>`, and `app://<id>` mentions.
- Apps SDK UI is host capability: iframe + `ui/*` bridge (JSON-RPC over `postMessage`) where supported.
- This repo focuses on a production companion-host path so embedded UI is usable now without patching stock Codex chat feed internals.

## Repository Layout

- `apps/companion-host`: web timeline + widget mount surface.
- `apps/codex-relay`: relay/runtime over `codex app-server`.
- `packages/protocol`: shared event and message contracts.
- `packages/widget-runtime`: template resolution, bridge runtime, safety checks.
- `packages/app-adapters/figma`: Figma-specific output shaping and widget heuristics.
- `packages/telemetry`: structured events for reliability and debugging.
- `src/host/*` and `src/codex-flavor-host.ts`: legacy compatibility paths kept for migration.

## Quick Start

```bash
npm install
npm run test
npm run validate:matrix
```

Run the MCP server:

```bash
npm run dev
```

Run companion host + relay:

```bash
npm run dev:host
```

Open:

- `http://localhost:8790`

Defaults:

- MCP endpoint: `http://localhost:8787/mcp`
- Health endpoint: `http://localhost:8787/health`

## Embedded UI Controls

- `EMBEDDED_UI_ENABLED=true|false`
- `EMBEDDED_UI_ALLOWED_APPS=figma,canva`
- `EMBEDDED_UI_BLOCKED_APPS=tripadvisor`

## Codex Config Notes

In Codex config, ensure connector support is enabled:

```toml
[features]
apps = true
# optional (experimental routing)
apps_mcp_gateway = true
```

App/tool policy controls are under `apps.*` (for example `apps.<id>.enabled`, per-tool approval/enabled overrides).

## Widget Resolution Behavior

Template URI precedence:

1. `result_meta.ui.resourceUri`
2. `result_meta["openai/outputTemplate"]`
3. `tool_meta.ui.resourceUri`
4. `tool_meta["openai/outputTemplate"]`

Server fallback rule:

1. try `item.server`
2. then try `codex_apps`

If template read fails, companion host falls back to structured/text output instead of hard-failing the turn.

## Key Docs

- `docs/index.md`
- `docs/architecture-spec.md`
- `docs/codex-flavor-host.md`
- `docs/plan1-codex-apps-ui-feasibility.md`

## OpenAI References

- Codex app-server apps/connectors: https://developers.openai.com/codex/app-server/#apps-connectors
- Codex config reference (`features.apps`, `apps.*`): https://developers.openai.com/codex/config-reference/
- Apps SDK quickstart intro: https://developers.openai.com/apps-sdk/quickstart/#introduction
- Build ChatGPT UI (iframe + `ui/*` bridge): https://developers.openai.com/apps-sdk/build/chatgpt-ui/#overview
- MCP Apps compatibility in ChatGPT: https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/#overview

## Current Constraint

Stock Codex inline iframe rendering is host-dependent. This project ships a companion embedded-UI path now and keeps contracts portable for future native host support.
