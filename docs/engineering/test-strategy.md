# Test Strategy: codex-apps-sdk-inline-widget-bridge-prototype

Date: 2026-02-27
Repository: codex-apps-sdk
Working stack: React, TypeScript

## Quality Gates

- Lint: not configured (no `npm run lint` script); treat `npm run build` as static quality gate for this prototype
- Test: `npm run test`
- Build: `npm run build`

## Test Scope

### Unit

- Core business logic: widget resolution precedence and bridge eligibility checks (`src/host/widget-resolution.ts`, `src/core/tool-meta.ts`)
- Validation rules: tool payload eligibility, URI allowlist enforcement, fallback reason mapping
- Error handling: deterministic fallback classification for unresolved templates, malformed payloads, and disabled policy

### Integration

- Data boundaries: `src/host/app-server-gateway.ts` resource/template reads and metadata enrichment
- Service boundaries: `apps/companion-host/src/server.ts` turn flow from tool event to render attempt/fallback event
- State transitions: enabled -> render attempted -> success/fallback telemetry sequencing

### End-to-End

- Primary user flow: mention app -> tool returns structured content -> inline widget render in companion host
- Critical edge flow: same scenario with bridge disabled verifies text-only completion and logged fallback reason

## Requirement-to-Test Mapping

| PRD criterion | Test level | Test case id |
|---|---|---|
| Detect and render eligible widget metadata in bridge mode | Unit + Integration | UT-BRIDGE-01, IT-HOST-01 |
| Preserve complete fallback when bridge unavailable | Unit + Integration + E2E | UT-FALLBACK-01, IT-HOST-02, E2E-TRIAGE-02 |
| Emit render/fallback telemetry for observability | Integration | IT-TELEM-01 |
| Reduce context switches in scripted triage scenario | E2E/Manual benchmark | E2E-BENCH-01 |

## Test Data and Fixtures

- Required fixtures: representative tool results with valid widget metadata, missing metadata, malformed metadata, and large payload variants
- Synthetic data needs: triage-oriented catalog entries that mimic PR/issue contexts without sensitive source data
- Cleanup strategy: reset per-run telemetry artifacts under `artifacts/plan1/` and isolate benchmark outputs by timestamp

## Release Verification Checklist

- [ ] New bridge eligibility and fallback logic covered by unit tests
- [ ] Integration tests verify host render/fallback sequencing and telemetry
- [ ] Scripted scenario validates baseline vs prototype behavior comparison
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Risk summary documented
