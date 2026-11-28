import { hc } from "hono/client";
import type { AppType } from "../../../api/src/app";

/**
 * The service binding ignores the host, so any absolute base URL works; this one only makes the
 * URL valid. The request never leaves Cloudflare (ADR 0005).
 */
const BINDING_BASE_URL = "https://command-center-api.internal";

/**
 * The header Cloudflare Access adds to the incoming request. The API validates it on every call
 * (ADR 0003, #14), so it is the only incoming header forwarded over the binding (#40). It is a
 * credential: never log it and never send it anywhere but the binding.
 */
const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/** The headers to forward from the incoming request: the Access assertion, if present, and nothing else. */
function forwardedHeaders(request: Request): Record<string, string> {
  const assertion = request.headers.get(ACCESS_JWT_HEADER);
  return assertion === null ? {} : { [ACCESS_JWT_HEADER]: assertion };
}

/**
 * A typed Hono client that reaches the API over the `API` service binding, forwarding the incoming
 * request's Access assertion unchanged.
 */
export function apiClient(api: Fetcher, request: Request) {
  return hc<AppType>(BINDING_BASE_URL, {
    headers: forwardedHeaders(request),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => api.fetch(input, init),
  });
}

export type ApiHealth = { ok: true } | { ok: false; error: string };

/** Calls `GET /api/health` over the binding. Never throws: failures come back as `ok: false`. */
export async function getApiHealth(api: Fetcher, request: Request): Promise<ApiHealth> {
  try {
    const res = await apiClient(api, request).api.health.$get();
    if (!res.ok) return { ok: false, error: `The API answered with status ${res.status}.` };
    const body = await res.json();
    return body.ok === true ? { ok: true } : { ok: false, error: "The API reported it is not ok." };
  } catch {
    return { ok: false, error: "The API could not be reached." };
  }
}
