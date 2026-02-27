import { spawn } from "node:child_process";
import readline from "node:readline";

type Json = Record<string, unknown>;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const TIMEOUT_MS = 60000;

class RpcClient {
  private id = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly rl: readline.Interface;
  public notifications: Json[] = [];

  constructor(private readonly proc: ReturnType<typeof spawn>) {
    if (!proc.stdout || !proc.stdin) {
      throw new Error("codex app-server did not provide stdio pipes");
    }
    this.rl = readline.createInterface({ input: proc.stdout });
    this.rl.on("line", (line) => this.onLine(line));
  }

  private onLine(line: string): void {
    let msg: Json;
    try {
      msg = JSON.parse(line) as Json;
    } catch {
      return;
    }

    const id = msg.id;
    if (typeof id === "number") {
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timeout);
      if (msg.error) {
        const err = msg.error as { code?: number; message?: string };
        pending.reject(
          new Error(`JSON-RPC ${err.code ?? "unknown"}: ${err.message ?? "unknown error"}`)
        );
        return;
      }
      pending.resolve(msg.result);
      return;
    }

    this.notifications.push(msg);
  }

  private send(payload: Json): void {
    if (!this.proc.stdin) {
      throw new Error("stdin is unavailable for codex app-server process");
    }
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  async request(method: string, params: Json = {}): Promise<unknown> {
    const id = ++this.id;
    this.send({ method, params, id });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for ${method}`));
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  notify(method: string, params: Json = {}): void {
    this.send({ method, params });
  }

  async close(): Promise<void> {
    this.rl.close();
    if (this.proc.stdin) {
      this.proc.stdin.end();
    }
    this.proc.kill("SIGTERM");
  }
}

const pickDefaultModel = async (client: RpcClient): Promise<string> => {
  const result = (await client.request("model/list", {
    limit: 50,
    includeHidden: false
  })) as { data?: Array<Record<string, unknown>> };
  const data = result.data ?? [];
  const preferred = data.find((row) => row.isDefault === true) ?? data[0];
  const model = preferred?.model;
  if (!model || typeof model !== "string") {
    throw new Error("No model found from model/list");
  }
  return model;
};

const parseArg = (name: string): string | undefined => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
};

const findApp = async (
  client: RpcClient,
  appName: string
): Promise<{ id: string; name: string; slug: string }> => {
  const result = (await client.request("app/list", {
    cursor: null,
    limit: 200,
    forceRefetch: false
  })) as { data?: Array<Record<string, unknown>> };

  const data = result.data ?? [];
  const app = data.find(
    (entry) => String(entry.name ?? "").toLowerCase() === appName.trim().toLowerCase()
  );
  if (!app) {
    throw new Error(`App "${appName}" not found in app/list`);
  }

  const id = String(app.id ?? "");
  const name = String(app.name ?? appName);
  const installUrl = String(app.installUrl ?? "");
  const slugMatch = /\/apps\/([^/]+)\//.exec(installUrl);
  const slug = slugMatch?.[1] ?? name.toLowerCase().replace(/\s+/g, "-");

  if (!id) {
    throw new Error(`App "${appName}" is missing an id`);
  }
  return { id, name, slug };
};

const summarizeNotifications = (notifications: Json[]): {
  sawToolCall: boolean;
  sawTurnCompleted: boolean;
  agentFinalText: string | null;
  mcpServers: string[];
  mcpTools: string[];
} => {
  let sawToolCall = false;
  let sawTurnCompleted = false;
  let agentFinalText: string | null = null;
  const mcpServers = new Set<string>();
  const mcpTools = new Set<string>();

  for (const msg of notifications) {
    const method = String(msg.method ?? "");
    const params = (msg.params ?? {}) as Json;

    if (method === "turn/completed") {
      sawTurnCompleted = true;
    }

    if (method === "item/completed" || method === "item/started") {
      const item = (params.item ?? {}) as Json;
      if (item.server || item.tool) {
        sawToolCall = true;
        if (typeof item.server === "string") mcpServers.add(item.server);
        if (typeof item.tool === "string") mcpTools.add(item.tool);
      }
      if (typeof item.text === "string" && item.text.length > 0) {
        agentFinalText = item.text;
      }
    }
  }

  return {
    sawToolCall,
    sawTurnCompleted,
    agentFinalText,
    mcpServers: Array.from(mcpServers),
    mcpTools: Array.from(mcpTools)
  };
};

const waitForTurnCompletion = async (client: RpcClient, timeoutMs = 70000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const completed = client.notifications.some(
      (msg) => String(msg.method ?? "") === "turn/completed"
    );
    if (completed) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

const main = async (): Promise<void> => {
  const appName = parseArg("--app") ?? "Figma";
  const prompt =
    parseArg("--prompt") ??
    "Use this connector to list what actions are available for this workspace. Keep it concise.";

  const proc = spawn("codex", ["app-server"], {
    stdio: ["pipe", "pipe", "inherit"]
  });
  const client = new RpcClient(proc);

  try {
    await client.request("initialize", {
      clientInfo: {
        name: "codex-app-mention-smoke",
        title: "Codex App Mention Smoke",
        version: "0.1.0"
      }
    });
    client.notify("initialized", {});

    const model = await pickDefaultModel(client);
    const app = await findApp(client, appName);

    const thread = (await client.request("thread/start", { model })) as {
      thread?: { id?: string };
    };
    const threadId = thread.thread?.id;
    if (!threadId) throw new Error("thread/start did not return thread.id");

    await client.request("turn/start", {
      threadId,
      input: [
        {
          type: "text",
          text: `$${app.slug} ${prompt}`
        },
        {
          type: "mention",
          name: app.name,
          path: `app://${app.id}`
        }
      ]
    });

    await waitForTurnCompletion(client);
    const summary = summarizeNotifications(client.notifications);

    console.log(
      JSON.stringify(
        {
          ok: true,
          model,
          app,
          summary,
          notificationCount: client.notifications.length
        },
        null,
        2
      )
    );
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
