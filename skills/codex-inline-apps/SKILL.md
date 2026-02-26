---
name: codex-inline-apps
description: Use this when a user wants inline app behavior in Codex using app mentions, MCP connector tools, and graceful fallback when host UI bridge support is unavailable.
---

# Codex Inline Apps

Use this skill when users ask to run Apps SDK-style workflows in Codex.

## Goals

- Keep tool workflows reliable in Codex even without iframe UI support.
- Use app mention + connector tools first.
- Use optional render tool metadata only when host UI support is explicitly enabled.

## Deterministic Flow

1. **Resolve app target**
- Discover apps/connectors with `app/list` (or `npm run apps:list` in this repo).
- Pick a target app and capture both slug and id.

2. **Invoke with mention contract**
- Put `$<app-slug>` in the user-facing text.
- Include mention path `app://<id>` in structured input where supported.

3. **Tool-first data path (always)**
- Call `search_or_fetch_*` tools for retrieval and structured outputs.
- Return usable text summaries and structured content regardless of UI support.

4. **Render path (conditional)**
- If host capability says UI bridge is supported, call `render_*_widget`.
- If not supported, skip rendering and continue with text + structured results.

5. **Summarize and guide**
- Always provide a concise result summary.
- If UI was skipped, state that fallback mode was used intentionally.

## Host Capability Rules

- Default mode is tool-first fallback (`UI_MODE=auto` with no host UI signal).
- Force UI metadata for ChatGPT-like hosts with `UI_MODE=chatgpt`.
- Disable UI metadata explicitly with `UI_MODE=off`.

## Local Commands

- Discovery: `npm run apps:list`
- Health check: `npm run apps:health`
- Validation matrix: `npm run validate:matrix`

## Output Contract

Every completion should include:
- Tool calls made.
- Whether UI path was enabled or skipped.
- Final user-facing result content.
