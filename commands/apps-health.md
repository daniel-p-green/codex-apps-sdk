---
description: Check Codex Apps connector readiness (CLI, features.apps, and app/list endpoint).
---

Run:

```bash
npm run apps:health
```

Interpretation:
- `[PASS]` means ready.
- `[WARN]` means likely usable but configuration should be tightened.
- `[FAIL]` means integration is blocked and should be fixed before relying on app mentions.
