export const WIDGET_URI = "ui://widget/catalog.html";

export const buildRenderToolMeta = (uiEnabled: boolean): Record<string, unknown> => {
  if (!uiEnabled) {
    return {};
  }

  return {
    ui: { resourceUri: WIDGET_URI },
    "openai/outputTemplate": WIDGET_URI
  };
};

export const buildFallbackHint = (uiEnabled: boolean): string =>
  uiEnabled
    ? "Host signaled UI capability. You can call render_catalog_widget to open inline UI."
    : "Host UI bridge unavailable or disabled. Continue with tool/text flow.";
