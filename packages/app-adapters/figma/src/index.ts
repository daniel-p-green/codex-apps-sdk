export const FIGMA_RENDER_TOOLS = new Set([
  "figma.generate_diagram",
  "figma.generate_deck",
  "figma.generate_asset",
  "figma_generate_diagram",
  "figma_generate_deck",
  "figma_generate_asset"
]);

const FIGMA_ALLOWED_HOSTS = new Set([
  "figma.com",
  "www.figma.com"
]);

export const isFigmaRenderCapableTool = (
  server: string | null | undefined,
  tool: string | null | undefined
): boolean => {
  if (!tool) {
    return false;
  }
  const normalizedServer = (server ?? "").trim().toLowerCase();
  const normalizedTool = tool.trim();

  if (FIGMA_RENDER_TOOLS.has(normalizedTool)) {
    return true;
  }

  if (normalizedServer === "figma") {
    return /generate_(diagram|deck|asset)/i.test(normalizedTool);
  }

  return false;
};

export const extractTrustedFigmaUrl = (result: unknown): string | null => {
  const haystack = JSON.stringify(result ?? {});
  const match = haystack.match(/https:\/\/(?:www\.)?figma\.com\/[^\s"'<>\)]+/i);
  if (!match) {
    return null;
  }

  const candidate = match[0];
  try {
    const url = new URL(candidate);
    if (!FIGMA_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    if (!url.pathname.startsWith("/")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};
