---
description: Run a live Codex app mention smoke test for an installed app connector (default Figma).
---

Default run (Figma):

```bash
npm run apps:smoke:mention
```

Custom app:

```bash
npm run apps:smoke:mention -- --app "Canva"
```

Custom prompt:

```bash
npm run apps:smoke:mention -- --app "Figma" --prompt "Use this connector and return 3 concrete actions you can execute now."
```

Review output JSON fields:
- `ok`
- `summary.sawToolCall`
- `summary.sawTurnCompleted`
- `summary.mcpServers`
- `summary.mcpTools`
- `summary.agentFinalText`
