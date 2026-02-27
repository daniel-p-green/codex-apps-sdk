import { describe, expect, it } from "vitest";

import {
  isAllowedBridgeOrigin,
  parseBridgeRequest
} from "../packages/widget-runtime/src/bridge-validation.js";

describe("bridge validation", () => {
  it("accepts only supported ui/tools bridge methods", () => {
    expect(
      parseBridgeRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "ui/initialize",
        params: {}
      })
    ).not.toBeNull();

    expect(
      parseBridgeRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "ui/not-supported"
      })
    ).toBeNull();
  });

  it("enforces origin allowlists when provided", () => {
    const allow = new Set(["https://www.figma.com"]);

    expect(isAllowedBridgeOrigin("https://www.figma.com", allow)).toBe(true);
    expect(isAllowedBridgeOrigin("https://evil.example", allow)).toBe(false);
    expect(isAllowedBridgeOrigin("https://anything.example", new Set())).toBe(true);
  });
});
