import { spawn, type ChildProcessByStdio } from "node:child_process";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";

type JsonObject = Record<string, unknown>;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AppServerClient {
  private readonly process: ChildProcessByStdio<Writable, Readable, null>;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly reader: readline.Interface;
  private requestId = 0;

  constructor() {
    this.process = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "inherit"]
    });
    this.reader = readline.createInterface({ input: this.process.stdout });
    this.reader.on("line", (line) => this.onLine(line));

    this.process.on("exit", (code, signal) => {
      const reason = `codex app-server exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
      for (const { reject, timeout } of this.pending.values()) {
        clearTimeout(timeout);
        reject(new Error(reason));
      }
      this.pending.clear();
    });
  }

  private onLine(line: string): void {
    let message: JsonObject;
    try {
      message = JSON.parse(line) as JsonObject;
    } catch {
      return;
    }

    if (typeof message.id !== "number") {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    this.pending.delete(message.id);
    clearTimeout(pending.timeout);

    if (message.error) {
      const error = message.error as { message?: string; code?: number };
      const details = `JSON-RPC error ${error.code ?? "unknown"}: ${error.message ?? "Unknown error"}`;
      pending.reject(new Error(details));
      return;
    }

    pending.resolve(message.result);
  }

  private send(payload: JsonObject): void {
    this.process.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  async request(method: string, params: JsonObject = {}, timeoutMs = 15000): Promise<unknown> {
    const id = ++this.requestId;
    const payload = { method, id, params };

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for ${method} response.`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.send(payload);
    });
  }

  notify(method: string, params: JsonObject = {}): void {
    this.send({ method, params });
  }

  async initialize(clientName = "codex-apps-sdk-spike"): Promise<void> {
    await this.request("initialize", {
      clientInfo: {
        name: clientName,
        title: "Codex Apps SDK Spike",
        version: "0.1.0"
      }
    });
    this.notify("initialized", {});
  }

  async close(): Promise<void> {
    this.reader.close();
    this.process.stdin.end();
    this.process.kill("SIGTERM");
  }
}
