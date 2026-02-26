import { AppServerClient } from "./lib/app-server-client.js";

interface AppListRow {
  id: string;
  name: string;
  description: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  installUrl: string | null;
}

const toRows = (result: unknown): AppListRow[] => {
  const data = (result as { data?: unknown[] })?.data ?? [];
  return data.map((entry) => {
    const app = entry as Record<string, unknown>;
    return {
      id: String(app.id ?? ""),
      name: String(app.name ?? ""),
      description: (app.description as string | null) ?? null,
      isAccessible: Boolean(app.isAccessible),
      isEnabled: Boolean(app.isEnabled),
      installUrl: (app.installUrl as string | null) ?? null
    };
  });
};

const run = async (): Promise<void> => {
  const client = new AppServerClient();
  try {
    await client.initialize("codex-apps-list-script");
    const result = await client.request("app/list", {
      cursor: null,
      limit: 100,
      forceRefetch: true
    });

    const rows = toRows(result);
    if (rows.length === 0) {
      console.log("No apps/connectors found.");
      return;
    }

    const simplified = rows.map((row) => ({
      id: row.id,
      name: row.name,
      accessible: row.isAccessible,
      enabled: row.isEnabled,
      installUrl: row.installUrl ?? ""
    }));

    console.table(simplified);
  } finally {
    await client.close();
  }
};

run().catch((error) => {
  console.error("[apps:list] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
