import type { BridgeRequest } from "../../protocol/src/index.js";

const ALLOWED_BRIDGE_METHODS = new Set([
  "ui/initialize",
  "ui/update-model-context",
  "tools/call"
]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const isAllowedBridgeOrigin = (
  origin: string,
  allowedOrigins: ReadonlySet<string>
): boolean => {
  if (allowedOrigins.size === 0) {
    return true;
  }
  return allowedOrigins.has(origin);
};

export const parseBridgeRequest = (input: unknown): BridgeRequest | null => {
  const data = asRecord(input);
  if (!data) {
    return null;
  }

  if (data.jsonrpc !== "2.0") {
    return null;
  }

  const method = typeof data.method === "string" ? data.method : null;
  if (!method || !ALLOWED_BRIDGE_METHODS.has(method)) {
    return null;
  }

  if (
    data.id !== undefined &&
    typeof data.id !== "number" &&
    typeof data.id !== "string"
  ) {
    return null;
  }

  const params = data.params;
  const normalizedParams =
    params === undefined
      ? undefined
      : asRecord(params)
        ? (params as Record<string, unknown>)
        : undefined;

  return {
    jsonrpc: "2.0",
    id: data.id as number | string | undefined,
    method: method as BridgeRequest["method"],
    ...(normalizedParams ? { params: normalizedParams } : {})
  };
};
