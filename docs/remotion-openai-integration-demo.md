# OpenAI-Branded Remotion Demo: Apps SDK + Codex Integration

## 1) Creative Direction Brief

- Message: A single MCP backend can power both rich Apps SDK UI hosts and tool-first Codex hosts.
- Audience: AI product and platform teams evaluating connector-first app experiences.
- Visual promise: Minimal, calm, technical confidence with OpenAI-aligned color cues and restrained motion.

## 2) Brand + Motion Control Sheet

- Platform: 16:9, 1920x1080, 30fps.
- Duration: 570 frames (19s).
- Tone: trustworthy, technical, precise.
- Anti-traits: noisy, gimmicky, chaotic.
- Color tokens:
  - `bgPrimary`: `#0A0E13`
  - `bgSecondary`: `#101722`
  - `textPrimary`: `#EFF5F8`
  - `textSecondary`: `#9FB2BF`
  - `accentPrimary`: `#10A37F`
  - `accentSecondary`: `#7FE8CF`
- Motion profile: measured (primary), calm (fallback/reduced motion).
- Transition density: low; fade/translate only.
- Reduced motion: prop-supported (`reducedMotion`).

## 3) Storyboard + Timing

1. Intro (120f): Position the core value proposition.
2. Architecture split (130f): Show shared backend with host-aware delivery paths.
3. Codex mention flow (130f): Show `$figma` + `app://connector...` flow and tool chips.
4. Proof panel (95f): Present smoke-test evidence (`ok`, `sawToolCall`, `sawTurnCompleted`).
5. Rollout roadmap (95f): `Figma` now, `PowerPoint` next, broader chat-to-BT expansion.

## 4) Build Notes

- Entry: `remotion/index.ts`
- Root: `remotion/Root.tsx`
- Composition: `OpenAIAppsCodexIntegrationDemo`
- Scene implementation: `remotion/scenes/OpenAIAppsCodexIntegrationDemo.tsx`

NPM scripts:

- `npm run remotion:studio`
- `npm run remotion:compositions`
- `npm run remotion:render:integration-demo`

Output render path:

- `out/openai-apps-codex-integration.mp4`

## 5) QA Rubric Score (First Pass)

- Narrative clarity: 2
- Brand fidelity: 2
- Motion craft: 2
- Pacing and rhythm: 2
- Accessibility and readability: 2
- Platform safety: 2
- Audio/VO integration: 1 (no soundtrack included)
- Emotional arc: 1 (functional product explainer arc)
- Technical stability: 2
- Distinctiveness: 2

Total: 18/20

Next-pass deltas:

1. Add optional voiceover bed and beat-sync transitions.
2. Add alternate 9:16 cut for mobile social previews.
