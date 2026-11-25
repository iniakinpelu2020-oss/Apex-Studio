import {
  RUNTIME_ENDPOINTS,
  getAuthHeaders,
  hasAuthToken,
} from "../config/runtimeConfig.js";
import { safeRequest } from "./safeRequest.js";

const STATUS_ID = "runtime-status";
const TOAST_ID = "runtime-toast";

const state = {
  mcp: { status: "idle", tools: [], error: null },
  runner: { status: "idle", error: null },
  n8n: { status: "configured", error: null },
};

const ensureToast = () => {
  let el = document.getElementById(TOAST_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = TOAST_ID;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = [
    "position:fixed",
    "right:14px",
    "bottom:14px",
    "max-width:min(420px, calc(100vw - 28px))",
    "padding:10px 12px",
    "border-radius:10px",
    "border:1px solid #3a2a2a",
    "background:#1d1416",
    "color:#f0caca",
    "font:12px/1.45 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,.35)",
    "z-index:9999",
    "display:none",
    "white-space:pre-wrap",
  ].join(";");
  document.body.appendChild(el);
  return el;
};

const ensureStatusBadge = () => {
  let el = document.getElementById(STATUS_ID);
  if (el) return el;
  // Fallback: attach near the existing header status if present.
  const anchor = document.getElementById("status");
  el = document.createElement("span");
  el.id = STATUS_ID;
  el.style.cssText = "color:#9a9aa8;font-size:12px;margin-left:8px;";
  if (anchor?.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
  else document.body.appendChild(el);
  return el;
};

const setBadge = (text, tone = "muted") => {
  const el = ensureStatusBadge();
  el.textContent = text;
  const colors = {
    muted: "#9a9aa8",
    ok: "#6ee7a8",
    warn: "#d9a33a",
    error: "#f0a0a0",
  };
  el.style.color = colors[tone] || colors.muted;
};

const showToast = (message, tone = "error") => {
  const el = ensureToast();
  el.textContent = message;
  const tones = {
    error: { border: "#5a2a2a", bg: "#1d1416", color: "#f0caca" },
    warn: { border: "#5a4a1a", bg: "#211c10", color: "#e8c98a" },
    ok: { border: "#1f4a33", bg: "#101d16", color: "#bfe8cf" },
  };
  const t = tones[tone] || tones.error;
  el.style.borderColor = t.border;
  el.style.background = t.bg;
  el.style.color = t.color;
  el.style.display = "block";
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.display = "none"; }, 12000);
};

export const reportRuntimeStatus = ({ level = "error", message, label, url }) => {
  const prefix = label ? `[${label}] ` : "";
  const text = `${prefix}${message}`;
  if (level === "error") {
    console.error(text, url ? { url } : "");
    showToast(text, "error");
  } else if (level === "warn") {
    console.warn(text, url ? { url } : "");
    showToast(text, "warn");
  } else {
    console.info(text, url ? { url } : "");
  }
};

const jsonRpc = async (url, method, params = {}, { timeoutMs, label, sessionId, report }) => {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const isNotification = method.startsWith("notifications/");
  const payload = { jsonrpc: "2.0", method, params };
  if (!isNotification) payload.id = `${method}-${Date.now()}`;
  return safeRequest(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    {
      timeoutMs,
      authHeaders: getAuthHeaders(),
      report: report === undefined ? reportRuntimeStatus : report,
      label,
    },
  );
};

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Some MCP transports may respond with SSE; try to extract JSON data lines.
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (let i = dataLines.length - 1; i >= 0; i -= 1) {
      try { return JSON.parse(dataLines[i]); } catch { /* continue */ }
    }
    return { raw: text };
  }
};

export async function initializeMcp() {
  const { url, name } = RUNTIME_ENDPOINTS.mcp;
  const label = `MCP:${name}`;
  state.mcp = { status: "connecting", tools: [], error: null };

  if (!hasAuthToken()) {
    const message = "Missing VITE_APEX_AUTH_TOKEN. MCP, n8n, and runner requests will be sent without Authorization; protected endpoints may reject them.";
    reportRuntimeStatus({ level: "warn", message, label, url });
  }

  const init = await jsonRpc(
    url,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "apex-media-gen", version: "1.0.0" },
    },
    { timeoutMs: 30_000, label },
  );

  if (!init.ok) {
    state.mcp = { status: "error", tools: [], error: init.error };
    return state.mcp;
  }

  const sessionId = init.response.headers.get("mcp-session-id") || "";
  const initPayload = await parseJsonResponse(init.response);
  console.info(`[${label}] initialize response`, initPayload, sessionId ? { sessionId } : "");
  if (initPayload?.error) {
    const msg = initPayload.error.message || JSON.stringify(initPayload.error);
    const err = new Error(`MCP initialize error: ${msg}`);
    reportRuntimeStatus({ level: "error", message: err.message, label, url });
    state.mcp = { status: "error", tools: [], error: err };
    return state.mcp;
  }

  // MCP streamable HTTP expects an initialized notification after initialize.
  // Non-fatal: log but do not toast on failure.
  const notif = await jsonRpc(
    url,
    "notifications/initialized",
    {},
    { timeoutMs: 10_000, label, sessionId, report: () => {} },
  );
  if (!notif.ok) console.warn(`[${label}] initialized notification failed`, notif.error?.message);

  const tools = await jsonRpc(url, "tools/list", {}, { timeoutMs: 30_000, label, sessionId });
  if (!tools.ok) {
    state.mcp = { status: "error", tools: [], error: tools.error };
    return state.mcp;
  }

  const toolsPayload = await parseJsonResponse(tools.response);
  if (toolsPayload?.error) {
    const msg = toolsPayload.error.message || JSON.stringify(toolsPayload.error);
    const err = new Error(`MCP tools/list error: ${msg}`);
    reportRuntimeStatus({ level: "error", message: err.message, label, url });
    state.mcp = { status: "error", tools: [], error: err };
    setBadge("MCP tool discovery failed", "error");
    return state.mcp;
  }
  const toolList = Array.isArray(toolsPayload?.result?.tools)
    ? toolsPayload.result.tools
    : Array.isArray(toolsPayload?.tools)
      ? toolsPayload.tools
      : [];

  state.mcp = { status: "ready", tools: toolList, error: null };
  console.info(`[${label}] discovered ${toolList.length} tool(s)`, toolList);
  return state.mcp;
}

export async function checkRunnerHealth() {
  const { url, name, timeoutMs } = RUNTIME_ENDPOINTS.runner;
  const label = `Runner:${name}`;
  state.runner = { status: "checking", error: null };

  // Health checks use a shorter timeout than the full runner request timeout;
  // cold starts are reported clearly by safeRequest.
  const healthTimeout = Math.min(30_000, timeoutMs);
  const base = url.replace(/\/$/, "");
  const candidates = [`${base}/health`, base];

  let lastResult = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const isLast = i === candidates.length - 1;
    const result = await safeRequest(
      candidate,
      { method: "GET", headers: { Accept: "application/json, text/plain, */*" } },
      {
        timeoutMs: healthTimeout,
        authHeaders: getAuthHeaders(),
        // Suppress noisy 404 toast for /health fallback; report final failures clearly.
        report: (evt) => {
          if (!isLast && evt?.error?.status === 404) {
            console.warn(`[${label}] ${evt.message}`);
            return;
          }
          reportRuntimeStatus(evt);
        },
        label,
      },
    );
    lastResult = result;
    if (result.ok) {
      state.runner = { status: "ready", error: null };
      console.info(`[${label}] health check OK`, candidate);
      return state.runner;
    }
    // If we got an HTTP response (not network/timeout), don't try fallbacks blindly
    // except 404 which may mean /health is not implemented.
    if (result.error?.status && result.error.status !== 404) break;
  }

  state.runner = { status: "error", error: lastResult?.error || null };
  return state.runner;
}

export function getRuntimeState() {
  return {
    ...state,
    endpoints: RUNTIME_ENDPOINTS,
    hasAuthToken: hasAuthToken(),
  };
}

export async function bootstrapRuntime() {
  console.info("[runtime] bootstrapping integrations", {
    mcp: RUNTIME_ENDPOINTS.mcp.url,
    n8n: RUNTIME_ENDPOINTS.n8n.url,
    runner: RUNTIME_ENDPOINTS.runner.url,
    hasAuthToken: hasAuthToken(),
  });

  setBadge("Connecting services…", "warn");

  // Run in background; do not block UI.
  const results = await Promise.allSettled([
    initializeMcp(),
    checkRunnerHealth(),
  ]);

  const mcp = results[0].status === "fulfilled" ? results[0].value : { status: "error" };
  const runner = results[1].status === "fulfilled" ? results[1].value : { status: "error" };

  const parts = [];
  parts.push(`MCP ${mcp.status === "ready" ? `ready (${mcp.tools?.length || 0} tools)` : mcp.status}`);
  parts.push(`Runner ${runner.status}`);
  const allOk = mcp.status === "ready" && runner.status === "ready";
  const anyOk = mcp.status === "ready" || runner.status === "ready";
  setBadge(parts.join(" · "), allOk ? "ok" : anyOk ? "warn" : "error");

  if (!allOk) {
    reportRuntimeStatus({
      level: "warn",
      message: `Runtime startup incomplete: ${parts.join(", ")}. See console for exact errors.`,
      label: "runtime",
    });
  }

  return getRuntimeState();
}

// Auto-bootstrap when loaded as a module script.
if (typeof document !== "undefined") {
  const start = () => {
    bootstrapRuntime().catch((err) => {
      console.error("[runtime] bootstrap failed", err);
      reportRuntimeStatus({
        level: "error",
        message: `Runtime bootstrap failed: ${err?.message || err}`,
        label: "runtime",
      });
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
