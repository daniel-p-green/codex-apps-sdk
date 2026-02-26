import { searchOrFetchCatalog } from "../src/core/catalog.js";
import { resolveHostCapabilities } from "../src/core/host-mode.js";
import { buildRenderToolMeta, WIDGET_URI } from "../src/core/tool-meta.js";

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const checks: CheckResult[] = [];

const assertCheck = (name: string, condition: boolean, details: string): void => {
  checks.push({ name, passed: condition, details });
};

const run = (): void => {
  const queryResult = searchOrFetchCatalog({ query: "chatgpt", limit: 3 });
  assertCheck(
    "data-tool-query",
    queryResult.items.length > 0,
    `Returned ${queryResult.items.length} item(s) for query='chatgpt'`
  );

  const idResult = searchOrFetchCatalog({
    ids: ["codex-app-server-apps", "codex-mcp-features"]
  });
  assertCheck(
    "data-tool-id-fetch",
    idResult.selectedIds.length === 2,
    `Resolved IDs: ${idResult.selectedIds.join(", ")}`
  );

  const fallbackCapabilities = resolveHostCapabilities({
    ...process.env,
    UI_MODE: "auto",
    HOST_SUPPORTS_MCP_APPS_UI: "false"
  });
  assertCheck(
    "auto-mode-defaults-tool-first",
    fallbackCapabilities.uiEnabled === false,
    fallbackCapabilities.reason
  );

  const chatgptCapabilities = resolveHostCapabilities({
    ...process.env,
    UI_MODE: "chatgpt"
  });
  assertCheck(
    "chatgpt-mode-enables-ui",
    chatgptCapabilities.uiEnabled === true,
    chatgptCapabilities.reason
  );

  const renderMetaDisabled = buildRenderToolMeta(false);
  assertCheck(
    "render-meta-disabled",
    Object.keys(renderMetaDisabled).length === 0,
    "No MCP Apps UI metadata in fallback mode"
  );

  const renderMetaEnabled = buildRenderToolMeta(true);
  const hasOutputTemplate =
    (renderMetaEnabled["openai/outputTemplate"] as string | undefined) === WIDGET_URI;
  assertCheck(
    "render-meta-enabled",
    hasOutputTemplate,
    "MCP Apps UI metadata present when host UI mode enabled"
  );

  for (const check of checks) {
    const marker = check.passed ? "[PASS]" : "[FAIL]";
    console.log(`${marker} ${check.name}: ${check.details}`);
  }

  const failed = checks.filter((check) => !check.passed).length;
  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log("[PASS] validation-matrix: all checks passed");
  }
};

run();
