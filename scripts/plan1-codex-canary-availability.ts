import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AppServerClient } from "./lib/app-server-client.js";

const ARTIFACT_DIR = path.resolve(process.cwd(), "artifacts/plan1");
const ARTIFACT_FILE = path.join(ARTIFACT_DIR, "codex-canary-app-availability.json");

const main = async (): Promise<void> => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const client = new AppServerClient();
  try {
    await client.initialize("plan1-codex-canary-availability");
    const result = (await client.request("app/list", {
      cursor: null,
      limit: 200,
      forceRefetch: false
    })) as { data?: Array<Record<string, unknown>> };

    const apps = result.data ?? [];
    const canary = apps.find((app) => {
      const name = String(app.name ?? "").toLowerCase();
      return (
        name.includes("plan1") ||
        name.includes("canary") ||
        name.includes("ui probe") ||
        name.includes("probe")
      );
    });

    const artifact = {
      generatedAt: new Date().toISOString(),
      host: "codex",
      appCount: apps.length,
      canaryAppAccessible: Boolean(canary),
      matchedApp: canary
        ? {
            id: String(canary.id ?? ""),
            name: String(canary.name ?? ""),
            installUrl: String(canary.installUrl ?? "")
          }
        : null,
      finalVerdict: canary
        ? "CANARY_APP_VISIBLE_IN_CODEX_APP_LIST"
        : "CANARY_APP_NOT_VISIBLE_IN_CODEX_APP_LIST"
    };

    writeFileSync(ARTIFACT_FILE, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, artifact: ARTIFACT_FILE }, null, 2));
  } finally {
    await client.close();
  }
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
