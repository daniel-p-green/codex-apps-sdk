import { describe, expect, it } from "vitest";

import { searchOrFetchCatalog } from "../src/core/catalog.js";

describe("searchOrFetchCatalog", () => {
  it("fetches deterministic records by ID", () => {
    const result = searchOrFetchCatalog({
      ids: ["codex-mcp-features", "apps-sdk-quickstart"]
    });

    expect(result.strategy).toBe("id_lookup");
    expect(result.selectedIds).toEqual(["codex-mcp-features", "apps-sdk-quickstart"]);
    expect(result.items).toHaveLength(2);
  });

  it("ranks query results", () => {
    const result = searchOrFetchCatalog({ query: "iframe", limit: 3 });

    expect(result.strategy).toBe("full_text");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.selectedIds[0]).toContain("apps-sdk-chatgpt-ui");
  });

  it("returns bounded default results", () => {
    const result = searchOrFetchCatalog({ limit: 1000 });

    expect(result.strategy).toBe("default");
    expect(result.items.length).toBeLessThanOrEqual(20);
  });
});
