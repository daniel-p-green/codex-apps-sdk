import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { AppServerClient } from "./lib/app-server-client.js";

const execFileAsync = promisify(execFile);

const readFeatureAppsFlag = async (): Promise<{
  configured: boolean;
  value: boolean | null;
}> => {
  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  const configRaw = await readFile(configPath, "utf8");

  const lineMatch = /^\s*apps\s*=\s*(true|false)\s*(?:#.*)?$/m.exec(configRaw);
  if (!lineMatch) {
    return { configured: false, value: null };
  }

  return { configured: true, value: lineMatch[1] === "true" };
};

const run = async (): Promise<void> => {
  const checks: Array<{ check: string; status: "pass" | "warn" | "fail"; details: string }> = [];

  try {
    const { stdout } = await execFileAsync("codex", ["--version"]);
    checks.push({
      check: "codex-cli",
      status: "pass",
      details: stdout.trim()
    });
  } catch (error) {
    checks.push({
      check: "codex-cli",
      status: "fail",
      details: error instanceof Error ? error.message : "Unable to execute codex --version"
    });
  }

  try {
    const featureApps = await readFeatureAppsFlag();
    if (!featureApps.configured) {
      checks.push({
        check: "features.apps",
        status: "warn",
        details:
          "features.apps not explicitly configured in ~/.codex/config.toml; set to true for connector support."
      });
    } else if (featureApps.value) {
      checks.push({
        check: "features.apps",
        status: "pass",
        details: "features.apps=true"
      });
    } else {
      checks.push({
        check: "features.apps",
        status: "fail",
        details: "features.apps=false (connectors disabled)"
      });
    }
  } catch (error) {
    checks.push({
      check: "features.apps",
      status: "warn",
      details:
        error instanceof Error
          ? `Could not parse ~/.codex/config.toml (${error.message})`
          : "Could not parse ~/.codex/config.toml"
    });
  }

  const client = new AppServerClient();
  try {
    await client.initialize("codex-apps-health-script");
    const result = await client.request("app/list", {
      cursor: null,
      limit: 10,
      forceRefetch: false
    });

    const count = ((result as { data?: unknown[] }).data ?? []).length;
    checks.push({
      check: "app/list",
      status: "pass",
      details: `app/list responded successfully (${count} app entries on this page)`
    });
  } catch (error) {
    checks.push({
      check: "app/list",
      status: "fail",
      details: error instanceof Error ? error.message : "app/list failed"
    });
  } finally {
    await client.close();
  }

  for (const check of checks) {
    const marker = check.status === "pass" ? "[PASS]" : check.status === "warn" ? "[WARN]" : "[FAIL]";
    console.log(`${marker} ${check.check}: ${check.details}`);
  }

  const hasFailure = checks.some((check) => check.status === "fail");
  if (hasFailure) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("[apps:health] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
