import { describe, expect, it } from "vitest";

import { createUiRenderPolicy, isUiRenderAllowed } from "../src/host/ui-policy.js";

describe("ui render policy", () => {
  it("disables all UI when EMBEDDED_UI_ENABLED=false", () => {
    const policy = createUiRenderPolicy({
      EMBEDDED_UI_ENABLED: "false"
    });

    expect(isUiRenderAllowed(policy, "Figma", "connector_1")).toBe(false);
  });

  it("enforces allow list when configured", () => {
    const policy = createUiRenderPolicy({
      EMBEDDED_UI_ALLOWED_APPS: "figma,canva"
    });

    expect(isUiRenderAllowed(policy, "Figma", "connector_1")).toBe(true);
    expect(isUiRenderAllowed(policy, "Tripadvisor", "connector_2")).toBe(false);
  });

  it("enforces block list before allow list", () => {
    const policy = createUiRenderPolicy({
      EMBEDDED_UI_ALLOWED_APPS: "figma,canva",
      EMBEDDED_UI_BLOCKED_APPS: "figma"
    });

    expect(isUiRenderAllowed(policy, "Figma", "connector_1")).toBe(false);
    expect(isUiRenderAllowed(policy, "Canva", "connector_2")).toBe(true);
  });
});
