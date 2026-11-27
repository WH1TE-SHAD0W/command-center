import { hc } from "hono/client";
import type { AppType } from "../../../api/src/app";

/**
 * The service binding ignores the host, so any absolute base URL works; this one only makes the
 * URL valid. The request never leaves Cloudflare (ADR 0005).
 */
const BINDING_BASE_URL = "https://command-center-api.internal";

/** A typed Hono client that reaches the API over the `API` service binding. */
export function apiClient(api: Fetcher) {
  return hc<AppType>(BINDING_BASE_URL, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => api.fetch(input, init),
  });
}

export type ApiHealth = { ok: true } | { ok: false; error: string };

/** Calls `GET /api/health` over the binding. Never throws: failures come back as `ok: false`. */
export async function getApiHealth(api: Fetcher): Promise<ApiHealth> {
  try {
    const res = await apiClient(api).api.health.$get();
    if (!res.ok) return { ok: false, error: `The API answered with status ${res.status}.` };
    const body = await res.json();
    return body.ok === true ? { ok: true } : { ok: false, error: "The API reported it is not ok." };
  } catch {
    return { ok: false, error: "The API could not be reached." };
  }
}
