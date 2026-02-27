const state = {
  sessionId: null,
  threadId: null,
  selectedModel: null,
  apps: [],
  models: [],
  policy: null
};

const bridgeFrames = new Map();

const els = {
  modelSelect: document.querySelector("#model-select"),
  appSelect: document.querySelector("#app-select"),
  refreshModels: document.querySelector("#refresh-models"),
  refreshApps: document.querySelector("#refresh-apps"),
  newThread: document.querySelector("#new-thread"),
  sendTurn: document.querySelector("#send-turn"),
  promptInput: document.querySelector("#prompt-input"),
  timeline: document.querySelector("#timeline"),
  threadId: document.querySelector("#thread-id"),
  policyChip: document.querySelector("#policy-chip")
};

const jsonRequest = async (url, method = "GET", body) => {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed for ${url}`);
  }
  return payload;
};

const createCard = (title, meta) => {
  const card = document.createElement("article");
  card.className = "event-card";
  const metaEl = document.createElement("div");
  metaEl.className = "event-meta";
  metaEl.textContent = meta;
  const titleEl = document.createElement("h3");
  titleEl.className = "event-title";
  titleEl.textContent = title;
  card.append(metaEl, titleEl);
  return card;
};

const appendCard = (card) => {
  els.timeline.prepend(card);
};

const renderPolicy = () => {
  if (!state.policy) {
    els.policyChip.textContent = "Policy unavailable";
    return;
  }
  const enabled = state.policy.enabled ? "enabled" : "disabled";
  const allowText = state.policy.allowedApps
    ? `allow=${state.policy.allowedApps.join(",")}`
    : "allow=all";
  els.policyChip.textContent = `Embedded UI ${enabled} (${allowText})`;
};

const renderModels = () => {
  els.modelSelect.innerHTML = "";
  for (const model of state.models) {
    const option = document.createElement("option");
    option.value = String(model.model || model.id || "");
    option.textContent = String(model.displayName || model.model || model.id || "unknown");
    if (model.isDefault === true) {
      option.selected = true;
      state.selectedModel = option.value;
    }
    els.modelSelect.append(option);
  }
  if (!state.selectedModel && els.modelSelect.options.length > 0) {
    state.selectedModel = els.modelSelect.options[0].value;
  }
  if (state.selectedModel) {
    els.modelSelect.value = state.selectedModel;
  }
};

const renderApps = () => {
  els.appSelect.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "No app mention";
  els.appSelect.append(empty);

  const apps = state.apps
    .filter((app) => app.isAccessible !== false && app.isEnabled !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  for (const app of apps) {
    const option = document.createElement("option");
    option.value = String(app.id || "");
    const slug = String(app.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    option.dataset.slug = slug;
    option.dataset.name = String(app.name || "");
    option.textContent = `${app.name} (${app.id})`;
    els.appSelect.append(option);
  }
};

const refreshHealth = async () => {
  const health = await jsonRequest("/api/health");
  state.policy = health.uiPolicy;
  renderPolicy();
};

const refreshModels = async () => {
  const payload = await jsonRequest("/api/models");
  state.models = payload.data || [];
  renderModels();
};

const refreshApps = async (forceRefetch = false) => {
  const payload = await jsonRequest(`/api/apps?forceRefetch=${String(forceRefetch)}`);
  state.apps = payload.data || [];
  renderApps();
};

const ensureSession = async () => {
  if (state.sessionId && state.threadId) {
    return {
      sessionId: state.sessionId,
      threadId: state.threadId
    };
  }
  const payload = await jsonRequest("/session/start", "POST", {
    model: state.selectedModel
  });
  state.sessionId = payload.sessionId || null;
  state.threadId = payload.threadId;
  els.threadId.textContent = `Thread: ${state.threadId}`;
  const card = createCard("Thread Started", "system");
  const p = document.createElement("p");
  p.className = "event-text";
  p.textContent = state.sessionId
    ? `${state.threadId} (session ${state.sessionId})`
    : state.threadId;
  card.append(p);
  appendCard(card);
  return {
    sessionId: state.sessionId,
    threadId: state.threadId
  };
};

const getSelectedApp = () => {
  const selected = els.appSelect.selectedOptions[0];
  if (!selected || !selected.value) {
    return null;
  }
  return {
    id: selected.value,
    name: selected.dataset.name || selected.textContent || "",
    slug: selected.dataset.slug || null
  };
};

const sendPrompt = async () => {
  const text = els.promptInput.value.trim();
  if (!text) {
    return;
  }
  const { sessionId, threadId } = await ensureSession();
  const app = getSelectedApp();
  await jsonRequest("/turn/start", "POST", {
    sessionId,
    threadId,
    text,
    app
  });
  els.promptInput.value = "";
  const card = createCard("User Prompt", "local");
  const p = document.createElement("p");
  p.className = "event-text";
  p.textContent = app ? `$${app.slug || app.name} ${text}` : text;
  card.append(p);
  appendCard(card);
};

const extractFigmaUrl = (result) => {
  const haystack = JSON.stringify(result || {});
  const match = haystack.match(/https:\/\/(?:www\.)?figma\.com\/[^\s"'<>)]+/i);
  return match ? match[0] : null;
};

const resolveTemplateUri = (resultMeta = {}, toolMeta = {}) => {
  const resultUi = resultMeta?.ui?.resourceUri;
  if (typeof resultUi === "string" && resultUi.trim()) {
    return resultUi.trim();
  }
  const resultOutput = resultMeta?.["openai/outputTemplate"];
  if (typeof resultOutput === "string" && resultOutput.trim()) {
    return resultOutput.trim();
  }

  const effectiveToolMeta = resultMeta.tool_meta || toolMeta || {};
  const toolUi = effectiveToolMeta?.ui?.resourceUri;
  if (typeof toolUi === "string" && toolUi.trim()) {
    return toolUi.trim();
  }
  const toolOutput = effectiveToolMeta?.["openai/outputTemplate"];
  if (typeof toolOutput === "string" && toolOutput.trim()) {
    return toolOutput.trim();
  }
  return null;
};

const registerBridgeFrame = (iframe, context) => {
  const frameId = crypto.randomUUID();
  iframe.dataset.bridgeId = frameId;
  iframe.addEventListener("load", () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      return;
    }
    bridgeFrames.set(frameWindow, {
      frameId,
      context
    });
  });
};

const notifyFramesToolResult = (result) => {
  for (const [frameWindow] of bridgeFrames.entries()) {
    try {
      frameWindow.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: result
        },
        "*"
      );
    } catch {
      // Ignore dispatch failures.
    }
  }
};

const readWidgetResource = async (primaryServer, uri) => {
  const candidates = [];
  if (typeof primaryServer === "string" && primaryServer.trim()) {
    candidates.push(primaryServer.trim());
  }
  if (!candidates.includes("codex_apps")) {
    candidates.push("codex_apps");
  }

  const errors = [];
  for (const server of candidates) {
    try {
      const response = await jsonRequest("/mcp/resource/read", "POST", {
        server,
        uri
      });
      return {
        ...response,
        attemptedServers: candidates
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${server}: ${detail}`);
    }
  }

  throw new Error(errors.join(" | "));
};

const mountWidgetFrame = async (container, item, templateUri) => {
  const response = await readWidgetResource(item.server, templateUri);

  const shell = document.createElement("section");
  shell.className = "widget-shell";
  const header = document.createElement("div");
  header.className = "widget-header";
  header.textContent = `${item.server}.${item.tool} -> ${templateUri} (${response.source})`;
  shell.append(header);

  const iframe = document.createElement("iframe");
  iframe.className = "widget-frame";
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-modals allow-popups allow-downloads"
  );

  const htmlBlock = (response.contents || []).find(
    (entry) =>
      typeof entry.text === "string" &&
      entry.text.trim().length > 0 &&
      typeof entry.mimeType === "string" &&
      entry.mimeType.toLowerCase().includes("html")
  );

  if (htmlBlock) {
    iframe.srcdoc = htmlBlock.text;
    registerBridgeFrame(iframe, {
      threadId: state.threadId,
      appSlug:
        item?.result?.result_meta?.connector_name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        null
    });
    shell.append(iframe);
    container.append(shell);
    return true;
  }

  const figmaUrl = extractFigmaUrl(item.result);
  if (figmaUrl) {
    iframe.removeAttribute("sandbox");
    iframe.src = figmaUrl;
    shell.append(iframe);
    container.append(shell);
    return true;
  }

  const warning = document.createElement("p");
  warning.className = "warning";
  warning.textContent =
    response.error ||
    "Widget template metadata is present but HTML content is unavailable from app-server.";
  shell.append(warning);
  container.append(shell);
  return false;
};

const renderMcpCall = async (item) => {
  const title = `${item.server}.${item.tool}`;
  const card = createCard(title, item.status || "mcpToolCall");

  const detail = document.createElement("pre");
  detail.className = "event-code";
  detail.textContent = JSON.stringify(
    {
      status: item.status,
      args: item.arguments,
      resultMeta: item.result?.result_meta || null
    },
    null,
    2
  );
  card.append(detail);

  appendCard(card);

  if (!item.result) {
    return;
  }

  const resultMeta = item.result.result_meta || {};
  const uiAllowed = resultMeta.ui_allowed !== false;
  const templateUri = resolveTemplateUri(resultMeta, item.tool_meta || {});
  const mountFigmaFallback = () => {
    const figmaUrl = extractFigmaUrl(item.result);
    if (!figmaUrl) {
      return false;
    }
    const iframe = document.createElement("iframe");
    iframe.className = "widget-frame";
    iframe.src = figmaUrl;
    card.append(iframe);
    return true;
  };

  if (uiAllowed && templateUri) {
    try {
      const mounted = await mountWidgetFrame(card, item, templateUri);
      if (!mounted) {
        mountFigmaFallback();
      }
    } catch (error) {
      const warning = document.createElement("p");
      warning.className = "warning";
      warning.textContent =
        error instanceof Error
          ? `Widget template read failed: ${error.message}. Falling back when possible.`
          : "Widget template read failed. Falling back when possible.";
      card.append(warning);
      mountFigmaFallback();
    }
  } else {
    const fallback = document.createElement("p");
    fallback.className = "warning";
    fallback.textContent = uiAllowed
      ? "No widget template URI found. Falling back to tool output."
      : "Host policy blocked embedded UI for this connector.";
    card.append(fallback);

    mountFigmaFallback();
  }

  notifyFramesToolResult(item.result);
};

const handleEventMessage = async (message) => {
  const method = message.method;
  const params = message.params || {};
  if (method === "item/completed" || method === "item/started") {
    const item = params.item || {};
    if (item.type === "agentMessage") {
      const card = createCard("Agent", method);
      const p = document.createElement("p");
      p.className = "event-text";
      p.textContent = item.text || "";
      card.append(p);
      appendCard(card);
      return;
    }
    if (item.type === "mcpToolCall") {
      await renderMcpCall(item);
      return;
    }
  }

  if (method === "turn/completed") {
    const card = createCard("Turn Completed", "turn");
    const p = document.createElement("p");
    p.className = "event-text";
    p.textContent = JSON.stringify(params.turn || {}, null, 2);
    card.append(p);
    appendCard(card);
  }
};

const connectEventStream = () => {
  const stream = new EventSource("/events");
  stream.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      void handleEventMessage(payload);
    } catch {
      // Ignore parse failures from keepalive.
    }
  };
  stream.onerror = () => {
    const card = createCard("Event Stream Warning", "network");
    const p = document.createElement("p");
    p.className = "warning";
    p.textContent = "Disconnected from event stream. Retrying automatically…";
    card.append(p);
    appendCard(card);
  };
};

window.addEventListener("message", async (event) => {
  if (!bridgeFrames.has(event.source)) {
    return;
  }

  const message = event.data;
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return;
  }

  const context = bridgeFrames.get(event.source);
  const reply = (result, error = null) => {
    if (typeof message.id !== "number") {
      return;
    }
    event.source.postMessage(
      error
        ? {
            jsonrpc: "2.0",
            id: message.id,
            error
          }
        : {
            jsonrpc: "2.0",
            id: message.id,
            result
          },
      "*"
    );
  };

  if (message.method === "ui/initialize") {
    reply({
      protocolVersion: "2026-01-26",
      host: {
        name: "codex-companion-host",
        mode: "production-prototype"
      }
    });
    await jsonRequest("/api/telemetry", "POST", {
      event: "bridge_initialize",
      frameId: context?.frameId || null
    }).catch(() => {});
    return;
  }

  if (message.method === "ui/update-model-context") {
    reply({ ok: true });
    return;
  }

  if (message.method === "tools/call") {
    const params = message.params || {};
    const name = params.name;
    const args = params.arguments;
    if (!state.threadId || typeof name !== "string") {
      reply(null, {
        code: -32000,
        message: "tools/call relay requires an active thread and tool name."
      });
      return;
    }
    try {
      await jsonRequest("/bridge/tools/call", "POST", {
        sessionId: state.sessionId,
        threadId: state.threadId,
        toolName: name,
        arguments: args,
        appSlug: context?.context?.appSlug || null
      });
      reply({
        queued: true
      });
    } catch (error) {
      reply(null, {
        code: -32001,
        message: error instanceof Error ? error.message : "tools/call relay failed"
      });
    }
    return;
  }

  reply({
    ignored: true
  });
});

els.modelSelect.addEventListener("change", () => {
  state.selectedModel = els.modelSelect.value || null;
});

els.refreshModels.addEventListener("click", () => {
  void refreshModels();
});
els.refreshApps.addEventListener("click", () => {
  void refreshApps(true);
});
els.newThread.addEventListener("click", () => {
  state.threadId = null;
  state.sessionId = null;
  void ensureSession();
});
els.sendTurn.addEventListener("click", () => {
  void sendPrompt();
});

const boot = async () => {
  await refreshHealth();
  await Promise.all([refreshModels(), refreshApps(false)]);
  connectEventStream();
};

void boot();
