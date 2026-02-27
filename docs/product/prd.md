# PRD: codex-apps-sdk-inline-widget-bridge-prototype

Date: 2026-02-27
Repository: codex-apps-sdk
Working stack: React, TypeScript

## Problem Statement

Codex workflows already support app discovery and tool invocation, but embedded Apps SDK-style inline UI is not reliably available. For review and triage tasks, this causes avoidable context switching and slower decisions. We need a prototype bridge in a controlled host to validate whether inline UI materially improves speed and confidence before considering broader investment.

## Goals

- Validate that inline widget rendering in the Codex companion host reduces context switching in review/triage workflows.
- Prove safe fallback behavior remains intact when inline rendering is unavailable or disabled.

## Non-Goals

- Full production rollout of inline widget support in native Codex.
- Re-architecting existing MCP tool contracts or replacing text-first tool outputs.

## Users and Context

- Primary user: developer/reviewer triaging code, app diagnostics, or related tasks.
- Secondary user: platform engineer evaluating host capability and feasibility risks.
- Key usage context: rapid issue review loops where the user alternates between tool outputs and decision-making.

## Requirements

### Functional

1. Companion host can detect eligible tool results (`ui.resourceUri` / `openai/outputTemplate`) and render a sandboxed inline widget when bridge mode is enabled.
2. Prototype can pass structured tool payloads into the widget with deterministic mapping.
3. Host exposes an explicit kill-switch/flag so inline rendering can be disabled instantly.
4. If rendering fails or bridge mode is off, users still receive complete text + structured output with no broken turn.
5. Telemetry captures render attempts, success/failure, fallback reason, and minimal interaction events relevant to triage.
6. Documentation includes setup, known constraints, and re-test trigger conditions.

### Non-Functional

1. Performance: inline widget first render target <=1.5s in local dev after tool response.
2. Reliability: prototype fallback path must succeed in 100% of forced-fallback test runs.
3. Accessibility: keyboard focus order and visible focus state inside host UI shell.
4. Security: widget iframe remains sandboxed; origin/resource resolution is allowlisted and auditable.

## Acceptance Criteria

1. Given bridge mode enabled in companion host, when a render-capable tool result arrives, then an inline widget is displayed and populated with structured content.
2. Given bridge mode disabled or unresolved widget metadata, when the same tool runs, then the turn completes with text/structured fallback and a logged fallback reason.
3. Given a scripted triage scenario, when run in baseline and prototype modes, then prototype mode shows lower recorded context switches and no regression in task completion.

## UX Notes

- Key user flow: mention app -> run tool -> receive text summary + inline widget -> inspect/select next action without leaving session.
- Empty and error states: no data, unsupported widget, bridge unavailable, and stale resource URI each return user-readable fallback text.
- Analytics events: `inline_render_attempt`, `inline_render_success`, `inline_render_fallback`, `inline_interaction`.

## Rollout and Measurement

- Rollout strategy: local spike first, then narrow internal dogfood in companion host only.
- Success metric: >=20% reduction in median triage decision time for selected scenario.
- Guardrail metric: zero increase in failed-turn rate versus current tool-only baseline.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Host capability assumptions are wrong | Prototype appears promising but does not transfer to native Codex | Keep host-specific assumptions explicit and tied to re-test triggers |
| Bridge integration introduces instability | Regressions in existing triage workflows | Feature flag + strict fallback path + regression tests |
| Widget resource trust boundary is weak | Security exposure in host runtime | Enforce allowlist and sandbox policy; log blocked resolutions |
| Prototype metrics are noisy | False confidence in hypothesis | Use the same scripted scenario across baseline and prototype runs |
