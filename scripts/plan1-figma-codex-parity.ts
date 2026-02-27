import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

interface SmokeResult {
  ok: boolean;
  model?: string;
  app?: { id?: string; name?: string; slug?: string };
  summary?: {
    sawToolCall?: boolean;
    sawTurnCompleted?: boolean;
    mcpTools?: string[];
    mcpServers?: string[];
    agentFinalText?: string | null;
  };
}

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts/plan1");
const ARTIFACT_FILE = path.join(ARTIFACT_DIR, "figma-codex-parity.json");

const runCommand = (
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });

const parseTrailingJson = (raw: string): SmokeResult => {
  const match = raw.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error("Could not find trailing JSON payload in smoke output.");
  }
  return JSON.parse(match[0]) as SmokeResult;
};

const main = async (): Promise<void> => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const prompt =
    "If this host supports embedded inline app UI, render it now. Otherwise explain what you can do via tools only.";

  const result = await runCommand("tsx", [
    "scripts/codex-app-mention-smoke.ts",
    "--app",
    "Figma",
    "--prompt",
    prompt
  ]);

  const payload = parseTrailingJson(result.stdout);
  const finalText = payload.summary?.agentFinalText ?? "";

  const uiKeywordSignal =
    /render(ed)?\s+(inline\s+)?(ui|widget|iframe)|opened\s+widget/i.test(finalText);

  const artifact = {
    generatedAt: new Date().toISOString(),
    host: "codex",
    app: payload.app?.name ?? "Figma",
    command: `tsx scripts/codex-app-mention-smoke.ts --app Figma --prompt \"${prompt}\"`,
    exitCode: result.exitCode,
    ok: payload.ok,
    uiRendered: false,
    bridgeDetected: false,
    bridgeMethods: [] as string[],
    errors: [] as string[],
    evidence: {
      sawToolCall: payload.summary?.sawToolCall ?? false,
      sawTurnCompleted: payload.summary?.sawTurnCompleted ?? false,
      mcpTools: payload.summary?.mcpTools ?? [],
      mcpServers: payload.summary?.mcpServers ?? [],
      uiKeywordSignal,
      agentFinalText: finalText
    },
    finalVerdict: "NO_INLINE_WIDGET_SIGNAL_IN_CODEX"
  };

  if (uiKeywordSignal) {
    artifact.errors.push(
      "Model text referenced possible UI language, but no host-level render evidence is available in this run."
    );
  }

  writeFileSync(ARTIFACT_FILE, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, artifact: ARTIFACT_FILE }, null, 2));
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
