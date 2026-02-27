export interface UiRenderPolicy {
  enabled: boolean;
  allowedApps: Set<string> | null;
  blockedApps: Set<string>;
}

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const parseList = (raw: string | undefined): Set<string> | null => {
  if (!raw) {
    return null;
  }

  const tokens = raw
    .split(",")
    .map(normalizeToken)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return null;
  }

  return new Set(tokens);
};

export const createUiRenderPolicy = (
  env: NodeJS.ProcessEnv = process.env
): UiRenderPolicy => {
  const enabled = env.EMBEDDED_UI_ENABLED !== "false";
  const allowedApps = parseList(env.EMBEDDED_UI_ALLOWED_APPS);
  const blockedApps = parseList(env.EMBEDDED_UI_BLOCKED_APPS) ?? new Set<string>();

  return {
    enabled,
    allowedApps,
    blockedApps
  };
};

export const isUiRenderAllowed = (
  policy: UiRenderPolicy,
  appName?: string | null,
  appId?: string | null
): boolean => {
  if (!policy.enabled) {
    return false;
  }

  const identifiers = [appName, appId]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeToken)
    .filter((value) => value.length > 0);

  if (identifiers.some((id) => policy.blockedApps.has(id))) {
    return false;
  }

  if (!policy.allowedApps) {
    return true;
  }

  return identifiers.some((id) => policy.allowedApps?.has(id));
};
