# Validation Matrix

Status: archived on February 27, 2026. Current test planning source: `docs/engineering/test-strategy.md`.

## Scenarios

### Positive

1. App appears in `app/list`, accessible and enabled.
2. Mentioning `app://<id>` path invokes connector tools.
3. Data tool output is understandable without widget UI.
4. Render tool provides UI metadata only when host capability enables it.

### Negative

1. `features.apps=false` blocks connector behavior.
2. Missing UI bridge still returns complete tool/text result.
3. Connector availability differs from enabled state and is surfaced by health scripts.

### Regression

1. Data tools work even when render metadata is disabled.
2. Render tool accepts data-tool IDs and remains read-only/idempotent.

## What Is Automated Here

- Unit tests:
- `tests/catalog.test.ts`
- `tests/host-mode.test.ts`

- Matrix script:
- `npm run validate:matrix`

- Environment checks:
- `npm run apps:health`
- `npm run apps:list`

## What Requires Host-Level Manual Validation

1. ChatGPT connector creation and inline iframe render.
2. Real Codex app mention execution in active thread context.
3. Approval UX for destructive/open-world connector tools (depends on local app/tool config and prompts).
