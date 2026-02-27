import { describe, expect, it } from "vitest";

import { resolveTemplateUri } from "../src/host/widget-resolution.js";

describe("resolveTemplateUri", () => {
  it("prefers result_meta.ui.resourceUri", () => {
    const resolved = resolveTemplateUri({
      resultMeta: {
        ui: {
          resourceUri: "ui://widget/from-result-ui.html"
        },
        "openai/outputTemplate": "ui://widget/from-result-output.html"
      },
      toolMeta: {
        ui: {
          resourceUri: "ui://widget/from-tool-ui.html"
        },
        "openai/outputTemplate": "ui://widget/from-tool-output.html"
      }
    });

    expect(resolved.uri).toBe("ui://widget/from-result-ui.html");
    expect(resolved.source).toBe("result_meta.ui.resourceUri");
  });

  it("falls back through the configured precedence", () => {
    const resolved = resolveTemplateUri({
      resultMeta: {
        "openai/outputTemplate": "ui://widget/from-result-output.html"
      },
      toolMeta: {
        "openai/outputTemplate": "ui://widget/from-tool-output.html"
      }
    });

    expect(resolved.uri).toBe("ui://widget/from-result-output.html");
    expect(resolved.source).toBe("result_meta.openai/outputTemplate");
  });

  it("returns null when no candidates exist", () => {
    const resolved = resolveTemplateUri({
      resultMeta: {},
      toolMeta: {}
    });

    expect(resolved.uri).toBeNull();
    expect(resolved.source).toBeNull();
  });
});
