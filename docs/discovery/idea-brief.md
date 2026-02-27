# Idea Brief: codex-apps-sdk-inline-widget-bridge-prototype

Date: 2026-02-27
Repository: codex-apps-sdk
Working stack: React, TypeScript

## Success Contract

- Done means: we can run a prototype in the Codex companion host where Apps SDK-style inline widgets render during a code review or triage flow, while the existing tool-first fallback still works unchanged.
- Tested by: automated baseline checks plus one scripted manual triage walkthrough (render-on path and forced-fallback path).
- No changes to: default safe behavior in `UI_MODE=auto`, existing connector/tool contracts, and current non-UI Codex workflows.

## 1) Problem

Current Codex triage workflows are mostly tool/text-only even when rich UI metadata exists. Reviewers frequently jump between terminal output, docs, and separate browser tabs to understand context. That context switching slows decisions and increases missed details during code review and issue triage.

## 2) Target User

- Primary user: engineers and AI-assisted reviewers handling code review, incident triage, and connector diagnostics in Codex.
- Explicitly out of scope: general end-user ChatGPT product experiences and full production rollout across all hosts.

## 3) Outcome

A reviewer can stay inside one Codex session and inspect richer structured output inline (for example, review cards/tables) instead of bouncing to external UIs. The prototype should shorten time-to-decision for triage tasks.

## 4) Success Signals

- Leading indicator: median context switches per triage session drop from an estimated ~4 to <=2 in prototype sessions.
- Lagging indicator: median time from first tool result to triage decision improves by >=20% versus tool-only baseline sessions.
- Manual acceptance check: the same scenario renders inline when bridge mode is enabled and cleanly falls back to text when bridge mode is disabled.

## 5) Constraints

- Technical: native Codex host parity with ChatGPT Apps bridge is not yet confirmed; prototype must validate value in controlled companion host paths first.
- Timeline: one spike cycle (roughly 2-4 engineering days).
- Compliance / policy: keep iframe/widget behavior sandboxed; do not expand privileged execution surface.

## 6) Non-Goals

- This effort will not ship production-grade inline Apps UI support for all Codex hosts.
- This effort will not replace or degrade existing tool-first workflows.

## 7) Assumptions

- The companion host can emulate enough of the Apps bridge contract to test workflow value.
- Triage workflows gain measurable speed from inline visual context, not only better text summaries.

## 8) Open Questions

- Which triage scenario should be benchmarked first (PR review, incident triage, or connector health)?
- What is the minimum viable bridge surface for prototype value (read-only render only vs lightweight interactions)?
