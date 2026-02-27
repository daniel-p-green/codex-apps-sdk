import type {
  ResolvedWidgetTemplate,
  ResultMetaShape,
  ToolMetaShape,
  WidgetTemplateSource
} from "../../protocol/src/index.js";

export interface ResolveTemplateInput {
  resultMeta?: ResultMetaShape | null;
  toolMeta?: ToolMetaShape | null;
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveWithoutServers = (input: ResolveTemplateInput): {
  uri: string | null;
  source: WidgetTemplateSource;
} => {
  const resultMeta = input.resultMeta ?? null;
  const directToolMeta = input.toolMeta ?? null;
  const resultToolMeta = resultMeta?.tool_meta ?? null;
  const toolMeta = resultToolMeta ?? directToolMeta;

  const resultUi = asNonEmptyString(resultMeta?.ui?.resourceUri);
  if (resultUi) {
    return { uri: resultUi, source: "result_meta.ui.resourceUri" };
  }

  const resultOutputTemplate = asNonEmptyString(resultMeta?.["openai/outputTemplate"]);
  if (resultOutputTemplate) {
    return { uri: resultOutputTemplate, source: "result_meta.openai/outputTemplate" };
  }

  const toolUi = asNonEmptyString(toolMeta?.ui?.resourceUri);
  if (toolUi) {
    return { uri: toolUi, source: "tool_meta.ui.resourceUri" };
  }

  const toolOutputTemplate = asNonEmptyString(toolMeta?.["openai/outputTemplate"]);
  if (toolOutputTemplate) {
    return { uri: toolOutputTemplate, source: "tool_meta.openai/outputTemplate" };
  }

  return { uri: null, source: null };
};

export const resolveTemplateUri = (input: ResolveTemplateInput): ResolvedWidgetTemplate => {
  const resolved = resolveWithoutServers(input);
  return {
    ...resolved,
    serverTried: []
  };
};

export const resolveTemplateUriWithServers = (
  input: ResolveTemplateInput,
  servers: string[]
): ResolvedWidgetTemplate => {
  const resolved = resolveWithoutServers(input);
  return {
    ...resolved,
    serverTried: servers
  };
};
