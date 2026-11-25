/**
 * Central runtime configuration.
 *
 * Internal integration endpoints are hardcoded here so they are never exposed
 * as user-editable settings. The authorization token is read from environment
 * variables at build/runtime and attached automatically to outbound requests.
 */

const readEnv = (key) => {
  // Vite statically replaces literal import.meta.env.VITE_* accesses at build time.
  // Dynamic access (import.meta.env[key]) is not replaced, so check literals first.
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const literal =
        key === "VITE_APEX_AUTH_TOKEN" ? import.meta.env.VITE_APEX_AUTH_TOKEN : undefined;
      const value = literal ?? import.meta.env[key];
      if (value != null && String(value).trim()) return String(value).trim();
    }
  } catch {
    // import.meta.env is not available in this runtime.
  }

  // Node/server contexts.
  try {
    if (typeof process !== "undefined" && process.env) {
      const serverKey = key.replace(/^VITE_/, "");
      const value = process.env[key] ?? process.env[serverKey];
      if (value != null && String(value).trim()) return String(value).trim();
    }
  } catch {
    // process is not available in this runtime.
  }

  return "";
};

export const APEX_AUTH_TOKEN = readEnv("VITE_APEX_AUTH_TOKEN");

export const RUNTIME_ENDPOINTS = Object.freeze({
  mcp: Object.freeze({
    name: "apex-mcp",
    transport: "http",
    url: "https://fuck.iniakinpelu2020.workers.dev",
  }),
  n8n: Object.freeze({
    name: "apex-n8n-webhook",
    method: "POST",
    url: "https://drippydee.app.n8n.cloud/webhook/apex-agent",
  }),
  runner: Object.freeze({
    name: "apex-remote-runner",
    url: "https://fuck-aev2.onrender.com",
    timeoutMs: 600_000, // 600 seconds
  }),
});

export const getAuthToken = () => APEX_AUTH_TOKEN;

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const hasAuthToken = () => Boolean(getAuthToken());
