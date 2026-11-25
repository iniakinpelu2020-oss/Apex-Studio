/**
 * Wrapped fetch with timeout, auth, and clear error reporting.
 * Surfaces exact HTTP status codes, cold-start timeouts, and network/CORS
 * failures to the console and to an optional status reporter.
 */

import { getAuthHeaders } from "../config/runtimeConfig.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export class SafeRequestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SafeRequestError";
    this.status = details.status ?? null;
    this.statusText = details.statusText ?? "";
    this.url = details.url ?? "";
    this.timeout = Boolean(details.timeout);
    this.network = Boolean(details.network);
    this.cause = details.cause;
  }
}

const describeFailure = (error, url) => {
  if (error?.timeout) {
    return `Request timed out after ${Math.round((error.timeoutMs || 0) / 1000)}s: ${url}. The service may be cold-starting; try again shortly.`;
  }
  if (error?.status != null) {
    const statusText = error.statusText ? ` ${error.statusText}` : "";
    return `HTTP ${error.status}${statusText} from ${url}`;
  }
  if (error?.network) {
    return `Network/CORS failure reaching ${url}. Check connectivity, CORS headers, and service availability.`;
  }
  return `Request failed for ${url}: ${error?.message || "unknown error"}`;
};

export async function safeRequest(url, options = {}, context = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    authHeaders = getAuthHeaders(),
    report = null,
    label = "request",
  } = context;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const mergedHeaders = {
    ...(options.headers || {}),
    ...authHeaders,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = new SafeRequestError(
        describeFailure({ status: response.status, statusText: response.statusText }, url),
        { status: response.status, statusText: response.statusText, url },
      );
      console.error(`[${label}]`, err.message, err);
      report?.({ level: "error", message: err.message, error: err, label, url });
      return { ok: false, response, error: err };
    }

    return { ok: true, response, error: null };
  } catch (cause) {
    clearTimeout(timeoutId);

    const isTimeout = controller.signal.aborted;
    const err = new SafeRequestError(
      describeFailure(
        isTimeout
          ? { timeout: true, timeoutMs }
          : { network: true, cause },
        url,
      ),
      { url, timeout: isTimeout, network: !isTimeout, cause, timeoutMs },
    );

    console.error(`[${label}]`, err.message, cause);
    report?.({ level: "error", message: err.message, error: err, label, url });
    return { ok: false, response: null, error: err };
  }
}
