# codex-apps-sdk-inline-widget-bridge-prototype Implementation Plan

Date: 2026-02-27
Repository: codex-apps-sdk
Feature slug: codex-apps-sdk-inline-widget-bridge-prototype

> Required workflow:
> 1) Define success criteria
> 2) If non-trivial, write a 3-step plan before code
> 3) Implement with test-first discipline

## Goal

Build a prototype compatibility bridge in the Codex companion host that can render Apps SDK-style inline widgets for triage workflows while preserving the current tool-first fallback path.

## Inputs

- `docs/discovery/idea-brief.md`
- `docs/product/prd.md`
- `docs/product/jtbd.md`
- `docs/product/use-cases.md`
- `docs/engineering/test-strategy.md`
- Existing baseline docs: `docs/plan1-codex-apps-ui-feasibility.md`, `docs/archive/feasibility-report-2026-02-26.md`

## Execution Plan (3 Steps)

1. Define the minimum bridge contract and benchmark scenario:
- Lock one triage scenario, metric capture method, and bridge/fallback telemetry schema.
2. Implement prototype bridge path behind explicit control:
- Add host-side render eligibility + widget mount path + deterministic fallback path.
3. Validate and decide:
- Run baseline vs prototype checks, summarize risks, and publish GO/NO-GO recommendation.

## Task Breakdown

### Task 1

- Files to modify: `apps/companion-host/src/server.ts`, `src/host/widget-resolution.ts`, `src/host/ui-policy.ts`, docs for benchmark protocol
- Tests to add first: unit tests for widget eligibility and fallback reason mapping
- Definition of done: benchmark scenario and expected telemetry events are documented and test fixtures exist

### Task 2

- Files to modify: `src/host/app-server-gateway.ts`, `apps/companion-host/src/server.ts`, relevant host UI assets under `apps/companion-host/public`
- Tests to add first: integration tests for render attempt/success/fallback flow
- Definition of done: bridge-enabled path renders inline widget in companion host; forced fallback path remains stable

### Task 3

- Files to modify: `scripts/plan1-*.ts` (or new prototype scripts), `docs/plan1-codex-apps-ui-feasibility.md`, decision artifact docs
- Tests to add first: scripted benchmark harness asserting baseline/prototype metric capture
- Definition of done: repeatable evidence package exists with final prototype recommendation and risks

## Verification Commands

- Dev: `npm run dev`
- Host: `npm run dev:host`
- Test: `npm run test`
- Build: `npm run build`
- Lint: not configured; use build/type checks as static gate

## Risk Notes

- Prototype signal may not generalize to native Codex host behavior.
- Inline render path can create hidden reliability regressions if fallback discipline is weak.
- Telemetry may overfit to one benchmark scenario unless multiple variants are sampled.

## Retrospective Prompt

What would we do differently next time to reduce risk or increase delivery speed?
