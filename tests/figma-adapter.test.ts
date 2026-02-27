import { describe, expect, it } from "vitest";

import {
  extractTrustedFigmaUrl,
  isFigmaRenderCapableTool
} from "../packages/app-adapters/figma/src/index.js";

describe("figma adapter", () => {
  it("recognizes render-capable figma tools", () => {
    expect(isFigmaRenderCapableTool("figma", "figma.generate_diagram")).toBe(true);
    expect(isFigmaRenderCapableTool("figma", "figma_generate_asset")).toBe(true);
    expect(isFigmaRenderCapableTool("figma", "figma.get_design_context")).toBe(false);
  });

  it("extracts trusted figma urls only", () => {
    const trusted = extractTrustedFigmaUrl({
      content:
        "Open https://www.figma.com/online-whiteboard/create-diagram/abc123?utm_source=other"
    });
    const untrusted = extractTrustedFigmaUrl({
      content: "Open https://example.com/figma-proxy/abc123"
    });

    expect(trusted).toContain("https://www.figma.com/");
    expect(untrusted).toBeNull();
  });
});
