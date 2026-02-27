# Plan 1 Feasibility Report: Figma ChatGPT-App Availability in Codex (Embedded UI Required)

Generated: 2026-02-27

## Objective
Determine if an existing ChatGPT Apps SDK experience (pilot: Figma) can run in Codex with **embedded inline app UI** (iframe/widget), not tools-only behavior.

## Locked Success Criteria
A GO requires all of the following:
1. ChatGPT control run passes (widget renders + bridge handshake).
2. Codex renders inline canary widget.
3. Codex records bridge handshake events.
4. Figma parity in Codex shows at least one embedded UI-capable interaction.

## Evidence Artifacts
- Baseline connector path: `artifacts/plan1/baseline-codex-connector.json`
- Canary server implementation: `src/plan1-canary-server.ts`
- Canary widget resource: `public/plan1-canary-widget.html`
- Codex canary discovery check: `artifacts/plan1/codex-canary-app-availability.json`
- Figma parity in Codex: `artifacts/plan1/figma-codex-parity.json`
- Probe event logs:
  - `artifacts/plan1/probe-events-chatgpt.jsonl`
  - `artifacts/plan1/probe-events-codex.jsonl`
- Reliability matrix (3 runs): `artifacts/plan1/reliability-summary.json`
- Screenshots:
  - `artifacts/plan1/chatgpt-widget.png`
  - `artifacts/plan1/codex-widget.png`
- Aggregated decision schema/output: `artifacts/plan1/decision-artifact.json`

## Test Results
### 1) Baseline connector/tool path in Codex
Result: **PASS**
- `ok: true`
- Figma app resolved (`id: connector_68df038e0ba48191908c8434991bbac2`)
- `summary.sawToolCall: true`
- `summary.sawTurnCompleted: true`

Interpretation: Codex connector + mention + tool invocation path is healthy.

### 2) UI canary host probe (Codex target)
Result: **FAIL (for embedded UI requirement)**
- Canary app visibility in Codex app catalog: `canaryAppAccessible: false`
- Bridge telemetry counts: Codex `1` event, ChatGPT `0` events
- No validated host-driven inline widget render in Codex

Interpretation: We could not establish host-level embedded Apps SDK widget support in Codex from this environment.

### 3) Figma parity check in Codex
Result: **FAIL (for embedded UI requirement)**
- `uiRendered: false`
- `bridgeDetected: false`
- Final parity verdict: `NO_INLINE_WIDGET_SIGNAL_IN_CODEX`
- Agent response indicates tools-only path, not inline widget rendering.

Interpretation: Figma is available as a connector/tool flow, but not as embedded inline app UI in this run.

### 4) ChatGPT control run
Result: **BLOCKED (environmental)**
- Captured page state indicates login gate in this environment.
- Control artifact: `artifacts/plan1/chatgpt-control.json`
- No completed developer-mode canary connector invocation from this environment.

Interpretation: Positive control could not be fully executed here due to authentication gate.

### 5) Reliability requirement (>=2/3 consistency)
Result: **PASS (consistency demonstrated for NO-GO signal)**
- Runs executed: `3`
- Required majority: `2`
- Baseline connector stability: `3/3 pass`
- Codex inline UI absent: `3/3`
- Canary app not visible in Codex catalog: `3/3`
- Reliability verdict: `CONSISTENT_NO_GO_SIGNAL`

## Decision Matrix (GO Criteria)
1. ChatGPT control pass: **No (blocked)**
2. Codex inline widget render: **No**
3. Codex bridge handshake evidence: **No**
4. Figma inline parity evidence in Codex: **No**

## Blocking Capability
Codex currently demonstrates connector/tool invocation but lacks verified host capability for Apps SDK-style embedded inline widget rendering and bridge method handshake (`ui/*`) in this validation run.

## Minimal External Dependency Needed
1. Codex host/platform support for MCP Apps-compatible embedded UI container (iframe/widget) and Apps bridge (`ui/*` postMessage contract).
2. App discoverability/install path for the canary app in Codex app catalog for the test account.
3. Authenticated ChatGPT developer-mode environment to complete positive control baseline.

## Re-test Trigger Checklist
1. Codex release notes or docs explicitly confirm embedded Apps SDK UI bridge support.
2. Canary app appears in Codex `app/list` for the same account/workspace.
3. ChatGPT control account is authenticated and can run developer-mode connector tests.
4. Re-run sequence:
   - `npm run plan1:baseline`
   - Start canary server: `npm run dev:plan1:canary`
   - Execute ChatGPT control run and collect `probe-events-chatgpt.jsonl`
   - Execute Codex target run and collect `probe-events-codex.jsonl`
   - `npm run plan1:figma:parity`
   - `npm run plan1:canary:availability`
   - `npm run plan1:decision`

## Final Verdict
NO-GO: Embedded Apps UI is not currently available in Codex
