export interface CatalogItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  tags: string[];
}

export interface SearchOrFetchArgs {
  query?: string;
  ids?: string[];
  limit?: number;
}

export interface SearchOrFetchResult {
  items: CatalogItem[];
  selectedIds: string[];
  totalMatches: number;
  strategy: "id_lookup" | "full_text" | "default";
}

export const SAMPLE_CATALOG: CatalogItem[] = [
  {
    id: "apps-sdk-quickstart",
    title: "Apps SDK Quickstart",
    summary: "Build an MCP server and optional web component UI for ChatGPT.",
    url: "https://developers.openai.com/apps-sdk/quickstart/",
    tags: ["apps-sdk", "quickstart", "chatgpt", "mcp"]
  },
  {
    id: "apps-sdk-chatgpt-ui",
    title: "Build your ChatGPT UI",
    summary: "MCP Apps bridge details for iframe UI rendered inline in ChatGPT.",
    url: "https://developers.openai.com/apps-sdk/build/chatgpt-ui/",
    tags: ["apps-sdk", "chatgpt", "ui", "iframe", "bridge"]
  },
  {
    id: "codex-app-server-apps",
    title: "Codex app-server Apps (connectors)",
    summary:
      "App discovery, mention syntax (app://), approvals, and connector behavior in Codex.",
    url: "https://developers.openai.com/codex/app-server/#apps-connectors",
    tags: ["codex", "app-server", "apps", "connectors", "mentions"]
  },
  {
    id: "codex-mcp-features",
    title: "Codex MCP Supported Features",
    summary: "Codex MCP support for stdio and streamable HTTP servers.",
    url: "https://developers.openai.com/codex/mcp/#supported-mcp-features",
    tags: ["codex", "mcp", "stdio", "http"]
  },
  {
    id: "codex-config-features",
    title: "Codex Config Reference Features",
    summary: "Feature flags including features.apps and app-level controls.",
    url: "https://developers.openai.com/codex/config-reference/#features",
    tags: ["codex", "config", "features", "apps"]
  }
];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

const uniqueById = (items: CatalogItem[]): CatalogItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

const normalizeLimit = (limit?: number): number => {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
};

const scoreItem = (item: CatalogItem, query: string): number => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 0;
  }

  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const tags = item.tags.join(" ").toLowerCase();
  const url = item.url.toLowerCase();

  let score = 0;
  if (title.includes(q)) score += 5;
  if (summary.includes(q)) score += 3;
  if (tags.includes(q)) score += 2;
  if (url.includes(q)) score += 1;

  return score;
};

export const searchOrFetchCatalog = (
  args: SearchOrFetchArgs,
  catalog: CatalogItem[] = SAMPLE_CATALOG
): SearchOrFetchResult => {
  const limit = normalizeLimit(args.limit);
  const requestedIds = (args.ids ?? []).filter(Boolean);
  const query = (args.query ?? "").trim();

  if (requestedIds.length > 0) {
    const byId = uniqueById(
      requestedIds
        .map((id) => catalog.find((item) => item.id === id))
        .filter((item): item is CatalogItem => Boolean(item))
    );
    return {
      items: byId.slice(0, limit),
      selectedIds: byId.map((item) => item.id),
      totalMatches: byId.length,
      strategy: "id_lookup"
    };
  }

  if (query.length > 0) {
    const ranked = catalog
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.item);

    return {
      items: ranked.slice(0, limit),
      selectedIds: ranked.map((item) => item.id),
      totalMatches: ranked.length,
      strategy: "full_text"
    };
  }

  return {
    items: catalog.slice(0, limit),
    selectedIds: catalog.slice(0, limit).map((item) => item.id),
    totalMatches: Math.min(catalog.length, limit),
    strategy: "default"
  };
};
