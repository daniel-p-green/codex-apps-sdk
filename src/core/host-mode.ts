export type UiMode = "auto" | "chatgpt" | "off";

export interface HostCapabilities {
  uiMode: UiMode;
  uiEnabled: boolean;
  reason: string;
}

const parseUiMode = (value: string | undefined): UiMode => {
  const normalized = (value ?? "auto").toLowerCase();
  if (normalized === "chatgpt") return "chatgpt";
  if (normalized === "off") return "off";
  return "auto";
};

export const resolveHostCapabilities = (
  env: NodeJS.ProcessEnv = process.env
): HostCapabilities => {
  const uiMode = parseUiMode(env.UI_MODE);
  const hostSupportsUi = env.HOST_SUPPORTS_MCP_APPS_UI === "true";

  if (uiMode === "chatgpt") {
    return {
      uiMode,
      uiEnabled: true,
      reason: "UI_MODE=chatgpt forces MCP Apps UI metadata on render tools."
    };
  }

  if (uiMode === "off") {
    return {
      uiMode,
      uiEnabled: false,
      reason: "UI_MODE=off disables MCP Apps UI metadata."
    };
  }

  if (hostSupportsUi) {
    return {
      uiMode,
      uiEnabled: true,
      reason:
        "UI_MODE=auto and HOST_SUPPORTS_MCP_APPS_UI=true enables optional inline UI metadata."
    };
  }

  return {
    uiMode,
    uiEnabled: false,
    reason:
      "UI_MODE=auto defaults to tool-first fallback unless host UI capability is explicitly signaled."
  };
};
