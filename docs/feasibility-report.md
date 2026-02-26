# Feasibility Report: Apps SDK Inline with Codex

Date: February 26, 2026

## Decision

Proceed with dual-mode delivery:

- Mode A (guaranteed): connector/tool inline behavior in Codex via app mentions and MCP tools.
- Mode B (conditional): Apps SDK iframe UI path enabled only for hosts that explicitly support MCP Apps bridge UI.

## Compatibility Matrix

| Capability | ChatGPT | Codex |
|---|---|---|
| MCP tool execution | Confirmed | Confirmed |
| Connector/app discovery | Confirmed | Confirmed (`app/list`, `/apps`) |
| Mention contract (`$slug`, `app://id`) | N/A/Host-specific | Confirmed |
| Inline iframe UI via MCP Apps bridge | Confirmed | Unknown/Not guaranteed in current Codex docs |
| Safe fallback without UI | Confirmed | Confirmed |

## Must-Haves

- Data tools produce useful text + structured outputs.
- Mention contract works for connector invocation.
- App discovery and health checks are scriptable.
- Render tool never blocks completion when UI host bridge is absent.

## Nice-to-Haves

- Auto-detect UI-capable hosts at runtime.
- Richer widget interactions after base reliability is proven.

## Risks and Mitigations

- Risk: Assuming Codex iframe parity with ChatGPT.
- Mitigation: Default to tool-first mode and gate UI metadata with explicit host capability flags.

- Risk: Connector/app config drift in local Codex setup.
- Mitigation: Include `apps:health` check (`codex --version`, `features.apps`, `app/list`).

## Source Links

- https://developers.openai.com/apps-sdk/quickstart/#introduction
- https://developers.openai.com/apps-sdk/quickstart/#add-your-app-to-chatgpt
- https://developers.openai.com/apps-sdk/build/chatgpt-ui/#overview
- https://developers.openai.com/codex/mcp/#supported-mcp-features
- https://developers.openai.com/codex/app-server/#apps-connectors
- https://developers.openai.com/codex/config-reference/#features
