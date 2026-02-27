export interface ToolMetaShape {
  ui?: {
    resourceUri?: string;
  };
  ["openai/outputTemplate"]?: string;
  [key: string]: unknown;
}

export interface ResultMetaShape {
  ui?: {
    resourceUri?: string;
  };
  ["openai/outputTemplate"]?: string;
  tool_meta?: ToolMetaShape | null;
  [key: string]: unknown;
}

export interface ResolveTemplateInput {
  resultMeta?: ResultMetaShape | null;
  toolMeta?: ToolMetaShape | null;
}

export interface ResolvedTemplateUri {
  uri: string | null;
  source:
    | "result_meta.ui.resourceUri"
    | "result_meta.openai/outputTemplate"
    | "tool_meta.ui.resourceUri"
    | "tool_meta.openai/outputTemplate"
    | null;
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveTemplateUri = (input: ResolveTemplateInput): ResolvedTemplateUri => {
  const resultMeta = input.resultMeta ?? null;
  const directToolMeta = input.toolMeta ?? null;
  const resultToolMeta = resultMeta?.tool_meta ?? null;
  const toolMeta = resultToolMeta ?? directToolMeta;

  const resultUi = asNonEmptyString(resultMeta?.ui?.resourceUri);
  if (resultUi) {
    return {
      uri: resultUi,
      source: "result_meta.ui.resourceUri"
    };
  }

  const resultOutputTemplate = asNonEmptyString(resultMeta?.["openai/outputTemplate"]);
  if (resultOutputTemplate) {
    return {
      uri: resultOutputTemplate,
      source: "result_meta.openai/outputTemplate"
    };
  }

  const toolUi = asNonEmptyString(toolMeta?.ui?.resourceUri);
  if (toolUi) {
    return {
      uri: toolUi,
      source: "tool_meta.ui.resourceUri"
    };
  }

  const toolOutputTemplate = asNonEmptyString(toolMeta?.["openai/outputTemplate"]);
  if (toolOutputTemplate) {
    return {
      uri: toolOutputTemplate,
      source: "tool_meta.openai/outputTemplate"
    };
  }

  return {
    uri: null,
    source: null
  };
};
