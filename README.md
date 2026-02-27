# Codex Apps SDK Dual-Mode Spike

This repository implements the plan to evaluate Apps SDK inline behavior in Codex with a production-safe fallback.

## What You Get

- Host-agnostic MCP server with:
- `search_or_fetch_catalog` (data tool, always reliable)
- `render_catalog_widget` (optional render tool for UI-capable hosts)
- Optional web component widget at `public/catalog-widget.html`
- Codex integration scripts:
- `npm run apps:list` (connector discovery via `app/list`)
- `npm run apps:health` (readiness checks)
- Validation matrix script:
- `npm run validate:matrix`
- Skill/plugin wrappers:
- `skills/codex-inline-apps/SKILL.md`
- `commands/apps-discover.md`
- `commands/apps-health.md`

## Quick Start

```bash
npm install
npm run test
npm run validate:matrix
```

Run MCP server:

```bash
npm run dev
```

Run custom Codex flavor host (web client over `codex app-server`):

```bash
npm run dev:host
```

Then open:

- `http://localhost:8790`

Server defaults:
- MCP endpoint: `http://localhost:8787/mcp`
- Health endpoint: `http://localhost:8787/health`

## Host Mode Controls

- `UI_MODE=auto` (default): tool-first fallback unless host capability is explicitly signaled.
- `UI_MODE=chatgpt`: force render tool UI metadata (`ui.resourceUri` + `openai/outputTemplate`).
- `UI_MODE=off`: force tool/text-only mode.

Optional capability signal in auto mode:

```bash
HOST_SUPPORTS_MCP_APPS_UI=true npm run dev
```

## Remotion Demo

OpenAI-branded explainer composition for the Apps SDK + Codex integration:

```bash
npm run remotion:studio
npm run remotion:compositions
npm run remotion:render:integration-demo
```

Render output:

- `out/openai-apps-codex-integration.mp4`
- Design/build notes: `docs/remotion-openai-integration-demo.md`

## Key Artifacts

- Feasibility report: `docs/feasibility-report.md`
- Architecture spec: `docs/architecture-spec.md`
- Codex flavor host spec: `docs/codex-flavor-host.md`
- Validation matrix: `docs/validation-matrix.md`
- Codex config example: `docs/codex-config.example.toml`

## Notes

- This spike intentionally defaults to tool-first behavior to avoid assuming Codex iframe parity with ChatGPT.
- The render tool remains safe: even without UI bridge support it returns complete text + structured outputs.
