import { describe, expect, it } from "vitest";

import { resolveHostCapabilities } from "../src/core/host-mode.js";
import { buildRenderToolMeta, WIDGET_URI } from "../src/core/tool-meta.js";

describe("host mode resolution", () => {
  it("defaults to UI disabled in auto mode", () => {
    const resolved = resolveHostCapabilities({
      UI_MODE: "auto",
      HOST_SUPPORTS_MCP_APPS_UI: "false"
    });

    expect(resolved.uiEnabled).toBe(false);
  });

  it("enables UI in chatgpt mode", () => {
    const resolved = resolveHostCapabilities({
      UI_MODE: "chatgpt"
    });

    expect(resolved.uiEnabled).toBe(true);
  });
});

describe("render tool metadata", () => {
  it("is empty when disabled", () => {
    expect(buildRenderToolMeta(false)).toEqual({});
  });

  it("includes output template when enabled", () => {
    const meta = buildRenderToolMeta(true);
    expect(meta["openai/outputTemplate"]).toBe(WIDGET_URI);
  });
});
