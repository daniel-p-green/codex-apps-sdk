export type JsonObject = Record<string, unknown>;

export type WidgetTemplateSource =
  | "result_meta.ui.resourceUri"
  | "result_meta.openai/outputTemplate"
  | "tool_meta.ui.resourceUri"
  | "tool_meta.openai/outputTemplate"
  | null;

export interface ToolMetaShape {
  ui?: {
    resourceUri?: string;
  };
  [key: string]: unknown;
  "openai/outputTemplate"?: string;
}

export interface ResultMetaShape {
  ui?: {
    resourceUri?: string;
  };
  [key: string]: unknown;
  "openai/outputTemplate"?: string;
  tool_meta?: ToolMetaShape | null;
}

export interface ResolvedWidgetTemplate {
  uri: string | null;
  source: WidgetTemplateSource;
  serverTried: string[];
}

export interface WidgetMountDecision {
  shouldRender: boolean;
  reason:
    | "ui_disabled"
    | "template_missing"
    | "blocked_app"
    | "ready"
    | "template_unreadable"
    | "bridge_error";
  templateUri?: string;
}

export interface AppMention {
  id: string;
  name?: string;
  slug?: string;
}

export interface SessionStartResponse {
  sessionId: string;
  threadId: string;
  model: string | null;
}

export interface TurnStartResponse {
  accepted: true;
  turnId: string;
}

export interface ResourceSecurityPolicy {
  widgetDomain: string | null;
  connectDomains: string[];
  resourceDomains: string[];
  frameDomains: string[];
}

export interface ResourceReadResult {
  server: string;
  uri: string;
  source: "app_server_rpc" | "status_cache" | "unavailable";
  resource: JsonObject | null;
  contents: JsonObject[];
  security: ResourceSecurityPolicy;
  error: string | null;
}

export interface ResourceTemplateReadResult {
  server: string;
  uriTemplate: string;
  source: "app_server_rpc" | "status_cache" | "unavailable";
  template: JsonObject | null;
  error: string | null;
}

export interface NormalizedMcpToolCallItem {
  type: "mcpToolCall";
  id?: string;
  server: string;
  tool: string;
  status?: string;
  arguments?: JsonObject;
  tool_meta?: ToolMetaShape | null;
  result?: {
    result_meta?: ResultMetaShape & {
      resolved_template_uri?: string | null;
      resolved_template_source?: WidgetTemplateSource;
      ui_allowed?: boolean;
      connector_name?: string | null;
      connector_id?: string | null;
      figma?: {
        renderCapable: boolean;
        trustedPreviewUrl: string | null;
      };
    };
    [key: string]: unknown;
  };
}

export interface BridgeRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: "ui/initialize" | "ui/update-model-context" | "tools/call";
  params?: JsonObject;
}

export interface BridgeResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: JsonObject;
  error?: {
    code: number;
    message: string;
  };
}

export type CompanionEventMethod =
  | "turn/started"
  | "turn/completed"
  | "item/started"
  | "item/completed"
  | "widget/decision"
  | "widget/error";

export interface CompanionEvent {
  method: CompanionEventMethod | string;
  params?: JsonObject;
}
