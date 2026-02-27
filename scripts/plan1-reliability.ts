import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts/plan1");
const BASELINE_FILE = path.join(ARTIFACT_DIR, "baseline-codex-connector.json");
const PARITY_FILE = path.join(ARTIFACT_DIR, "figma-codex-parity.json");
const AVAILABILITY_FILE = path.join(ARTIFACT_DIR, "codex-canary-app-availability.json");
const OUTPUT_FILE = path.join(ARTIFACT_DIR, "reliability-summary.json");

const RUNS = Number(process.env.PLAN1_RELIABILITY_RUNS ?? 3);

const runCommand = (
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

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

const readJson = (filePath: string): Record<string, unknown> => {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

const boolValue = (value: unknown): boolean => Boolean(value);
const strValue = (value: unknown): string => String(value ?? "");

const main = async (): Promise<void> => {
  if (RUNS < 1) {
    throw new Error("PLAN1_RELIABILITY_RUNS must be >= 1");
  }

  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const baselineRuns: Array<Record<string, unknown>> = [];
  const parityRuns: Array<Record<string, unknown>> = [];
  const availabilityRuns: Array<Record<string, unknown>> = [];

  for (let i = 1; i <= RUNS; i += 1) {
    const baselineExec = await runCommand("tsx", ["scripts/plan1-capture-baseline.ts"]);
    const baseline = readJson(BASELINE_FILE);
    baselineRuns.push({
      run: i,
      exitCode: baselineExec.exitCode,
      ok: boolValue(baseline.ok),
      sawToolCall: boolValue((baseline.summary as Record<string, unknown>)?.sawToolCall),
      sawTurnCompleted: boolValue((baseline.summary as Record<string, unknown>)?.sawTurnCompleted)
    });

    const parityExec = await runCommand("tsx", ["scripts/plan1-figma-codex-parity.ts"]);
    const parity = readJson(PARITY_FILE);
    parityRuns.push({
      run: i,
      exitCode: parityExec.exitCode,
      uiRendered: boolValue(parity.uiRendered),
      bridgeDetected: boolValue(parity.bridgeDetected),
      finalVerdict: strValue(parity.finalVerdict)
    });

    const availabilityExec = await runCommand("tsx", [
      "scripts/plan1-codex-canary-availability.ts"
    ]);
    const availability = readJson(AVAILABILITY_FILE);
    availabilityRuns.push({
      run: i,
      exitCode: availabilityExec.exitCode,
      canaryAppAccessible: boolValue(availability.canaryAppAccessible),
      finalVerdict: strValue(availability.finalVerdict)
    });
  }

  const baselinePassCount = baselineRuns.filter(
    (run) => boolValue(run.ok) && boolValue(run.sawToolCall) && boolValue(run.sawTurnCompleted)
  ).length;

  const codexUiAbsentCount = parityRuns.filter(
    (run) => !boolValue(run.uiRendered) && !boolValue(run.bridgeDetected)
  ).length;

  const canaryMissingCount = availabilityRuns.filter(
    (run) => !boolValue(run.canaryAppAccessible)
  ).length;

  const requiredMajority = Math.ceil(RUNS * (2 / 3));
  const artifact = {
    generatedAt: new Date().toISOString(),
    runs: RUNS,
    requiredMajority,
    baselineRuns,
    parityRuns,
    availabilityRuns,
    summary: {
      baselineConnectorStable: baselinePassCount >= requiredMajority,
      codexInlineUiAbsentConsistent: codexUiAbsentCount >= requiredMajority,
      canaryNotVisibleConsistent: canaryMissingCount >= requiredMajority
    },
    finalVerdict:
      baselinePassCount >= requiredMajority &&
      codexUiAbsentCount >= requiredMajority &&
      canaryMissingCount >= requiredMajority
        ? "CONSISTENT_NO_GO_SIGNAL"
        : "INCONSISTENT_SIGNAL_REVIEW_REQUIRED"
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, artifact: OUTPUT_FILE }, null, 2));
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
