# Use Cases: codex-apps-sdk-inline-widget-bridge-prototype

Date: 2026-02-27
Repository: codex-apps-sdk

## Primary Use Cases

### UC-1: Happy Path (Triage with Inline Context)

- Actor: engineer reviewing issue context in Codex companion host
- Trigger: user invokes an app/tool flow that returns render metadata and structured content
- Preconditions: companion host bridge mode enabled; widget resource resolvable
- Main flow:
1. User runs a triage prompt with app mention and receives tool result.
2. Host renders inline widget using resolved template/resource metadata.
3. User inspects structured details inline and chooses next action without opening external tabs.
- Expected result: user reaches a triage decision in one session with fewer context switches.

### UC-2: Common Variation (Fallback-First Reliability)

- Actor: engineer using same workflow in a non-bridge or bridge-disabled context
- Trigger: render metadata is absent, disabled, or unsupported
- Preconditions: standard tool-first path available
- Main flow:
1. User runs the same triage prompt.
2. Host detects bridge is disabled/unsupported and skips inline render attempt.
3. User receives complete text + structured fallback output and continues task.
- Expected result: no blocked turn; workflow remains fully usable.

## Edge Cases

### EC-1

- Scenario: resource URI is present but unresolved by widget resolution policy
- System behavior: emit fallback reason (`resource_unresolved`) and continue with text output
- User-visible response: clear note that inline render was skipped, plus actionable data in fallback

### EC-2

- Scenario: structured payload is incomplete for widget rendering
- System behavior: validate payload, render empty-state widget or fallback deterministically
- User-visible response: explicit empty-state/fallback messaging, no silent failure

## Failure Cases

### FC-1

- Failure mode: iframe or bridge handshake fails at runtime
- Detection: timeout + telemetry event (`inline_render_fallback`, reason=`bridge_handshake_failed`)
- Recovery path: automatically switch to text/structured fallback without ending the turn

### FC-2

- Failure mode: app-server or MCP resource fetch errors during render phase
- Detection: host gateway returns error state with correlation id
- Recovery path: show concise host error message and continue with tool data already returned
