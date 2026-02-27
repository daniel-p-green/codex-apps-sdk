import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface DecisionItem {
  host: "chatgpt" | "codex";
  uiRendered: boolean;
  bridgeDetected: boolean;
  bridgeMethods: string[];
  errors: string[];
  finalVerdict: string;
}

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts/plan1");
const DECISION_FILE = path.join(ARTIFACT_DIR, "decision-artifact.json");

const readJsonIfExists = (filePath: string): Record<string, unknown> | null => {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

const countJsonlLines = (filePath: string): number => {
  if (!existsSync(filePath)) return 0;
  const raw = readFileSync(filePath, "utf8").trim();
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
};

const main = (): void => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const chatgptControl = readJsonIfExists(
    path.join(ARTIFACT_DIR, "chatgpt-control.json")
  );
  const codexParity = readJsonIfExists(path.join(ARTIFACT_DIR, "figma-codex-parity.json"));
  const canaryAvailability = readJsonIfExists(
    path.join(ARTIFACT_DIR, "codex-canary-app-availability.json")
  );
  const reliability = readJsonIfExists(path.join(ARTIFACT_DIR, "reliability-summary.json"));

  const chatgptEvents = countJsonlLines(path.join(ARTIFACT_DIR, "probe-events-chatgpt.jsonl"));
  const codexEvents = countJsonlLines(path.join(ARTIFACT_DIR, "probe-events-codex.jsonl"));

  const chatgptDecision: DecisionItem = {
    host: "chatgpt",
    uiRendered: Boolean(chatgptControl?.uiRendered),
    bridgeDetected: Boolean(chatgptControl?.bridgeDetected),
    bridgeMethods: Array.isArray(chatgptControl?.bridgeMethods)
      ? (chatgptControl?.bridgeMethods as string[])
      : [],
    errors:
      chatgptControl && Array.isArray(chatgptControl.errors)
        ? (chatgptControl.errors as string[])
        : [
            "ChatGPT control run not completed in this environment (requires authenticated developer-mode connector setup)."
          ],
    finalVerdict: String(chatgptControl?.finalVerdict ?? "CHATGPT_CONTROL_NOT_COMPLETED")
  };

  const codexDecision: DecisionItem = {
    host: "codex",
    uiRendered: Boolean(codexParity?.uiRendered),
    bridgeDetected: Boolean(codexParity?.bridgeDetected),
    bridgeMethods: Array.isArray(codexParity?.bridgeMethods)
      ? (codexParity?.bridgeMethods as string[])
      : [],
    errors: [
      ...((Array.isArray(codexParity?.errors) ? (codexParity?.errors as string[]) : []) ?? []),
      ...(canaryAvailability && canaryAvailability.canaryAppAccessible === false
        ? ["Canary app is not visible in Codex app/list for this account."]
        : [])
    ],
    finalVerdict: String(codexParity?.finalVerdict ?? "CODEX_PROBE_NOT_COMPLETED")
  };

  const go =
    chatgptDecision.uiRendered &&
    chatgptDecision.bridgeDetected &&
    codexDecision.uiRendered &&
    codexDecision.bridgeDetected;

  const artifact = {
    generatedAt: new Date().toISOString(),
    schema: [
      "host",
      "uiRendered",
      "bridgeDetected",
      "bridgeMethods",
      "errors",
      "finalVerdict"
    ],
    probeEventCounts: {
      chatgpt: chatgptEvents,
      codex: codexEvents
    },
    reliability: reliability
      ? {
          runs: Number(reliability.runs ?? 0),
          requiredMajority: Number(reliability.requiredMajority ?? 0),
          summary:
            (reliability.summary as Record<string, unknown> | undefined) ?? {},
          finalVerdict: String(reliability.finalVerdict ?? "")
        }
      : null,
    hosts: [chatgptDecision, codexDecision],
    finalVerdict: go
      ? "GO: Embedded Apps UI is possible in Codex (conditions listed)"
      : "NO-GO: Embedded Apps UI is not currently available in Codex"
  };

  writeFileSync(DECISION_FILE, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, artifact: DECISION_FILE }, null, 2));
};

main();
