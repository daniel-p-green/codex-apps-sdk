# JTBD: codex-apps-sdk-inline-widget-bridge-prototype

Date: 2026-02-27
Repository: codex-apps-sdk

## Core Job Statement

When I am triaging code or app issues in Codex, I want rich inline context next to tool results, so I can decide and act without switching between multiple tools and tabs.

## Primary Jobs

1. Quickly understand whether a tool result is actionable during review/triage.
2. Compare options and choose next steps without leaving the active Codex workflow.

## Job Steps

| Step | Current friction | Desired progress |
|---|---|---|
| Discover | Tool output is informative but visually sparse for rapid triage | Surface structured context inline with the same turn |
| Decide | User opens extra tabs/docs to inspect details | Keep decision artifacts inside one host surface |
| Execute | Context switching breaks momentum and increases misreads | Execute next action from the same flow with clear state |
| Verify | Hard to confirm fallback/bridge behavior quickly | Show explicit render/fallback state with telemetry breadcrumbs |
| Maintain | Feasibility status drifts across environments | Preserve repeatable benchmark scripts and re-test triggers |

## Outcome Expectations

- Speed: shorter time from first result to triage decision.
- Confidence: less ambiguity about what data is being rendered and why.
- Control: explicit user/operator control over bridge-on vs fallback mode.

## Forces of Adoption

### Push (pain)

- Repetitive context switching in code review and issue triage sessions.

### Pull (benefits)

- Faster understanding and decision-making with inline visual context.

### Anxiety (risk)

- Concern that prototype behavior will not generalize to native Codex host support.

### Habits (status quo)

- Existing tool-first workflow is stable and already operational.

## Evidence Links

- Feasibility baseline and parity artifacts: `docs/plan1-codex-apps-ui-feasibility.md`, `artifacts/plan1/*`
- Existing architecture and fallback behavior: `docs/architecture-spec.md`, `docs/archive/feasibility-report-2026-02-26.md`
