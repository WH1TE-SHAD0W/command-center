import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createWorker, type Bindings } from "../../src/app";
import type { Module } from "../../src/modules";
import { PUBLIC_ORIGIN } from "../../src/oauth";
import { accessHeaders } from "./access";

/**
 * A synthetic Hermes: registers an OAuth client, approves it through `/authorize` with a
 * synthetic Access JWT, and exchanges the code (PKCE S256) for a token. No real tokens.
 */

export const REDIRECT_URI = "http://127.0.0.1:8765/callback";
export const MCP_URL = `${PUBLIC_ORIGIN}/mcp`;

export type Worker = ReturnType<typeof createWorker>;

export const workerFor = (moduleList: readonly Module[] = []) => createWorker(moduleList);

/** Calls the worker the way the runtime does. `env` is copied: the provider adds to it. */
export async function call(
  worker: Worker,
  url: string,
  init: RequestInit = {},
  bindings: Bindings = env,
) {
  const ctx = createExecutionContext();
  const request = new Request(new URL(url, PUBLIC_ORIGIN), init);
  const res = await worker.fetch(request, { ...bindings }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export async function registerClient(worker: Worker, name = "Synthetic Hermes") {
  const res = await call(worker, "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { client_id: string };
}

export function authorizeUrl(clientId: string, challenge: string, state = "synthetic-state") {
  const url = new URL("/authorize", PUBLIC_ORIGIN);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    resource: MCP_URL,
  }).toString();
  return url.toString();
}

/** `name=value` pairs from every Set-Cookie header, appended to the previous Cookie header. */
export function cookiesFrom(res: Response, previous = "") {
  const pairs = res.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  return [previous, ...pairs].filter(Boolean).join("; ");
}

export function consentHandle(page: string) {
  const match = page.match(/name="handle" value="([^"]+)"/);
  if (!match) throw new Error("no consent handle on the page");
  return match[1];
}

export async function postConsent(
  worker: Worker,
  handle: string,
  decision: string,
  headers: Record<string, string>,
  bindings: Bindings = env,
) {
  return call(
    worker,
    "/authorize",
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ handle, decision }).toString(),
    },
    bindings,
  );
}

/**
 * GET /authorize with a synthetic Access JWT, then approve on the consent page. When the
 * approval is remembered, the GET already redirects. Returns the redirect back to the client.
 */
export async function approve(
  worker: Worker,
  clientId: string,
  challenge: string,
  cookie = "",
  bindings: Bindings = env,
) {
  const access = await accessHeaders(env.OAUTH_KV);
  const page = await call(
    worker,
    authorizeUrl(clientId, challenge),
    { headers: { ...access, ...(cookie ? { Cookie: cookie } : {}) } },
    bindings,
  );
  if (page.status === 302) {
    return { location: page.headers.get("Location"), cookie, consentShown: false };
  }
  if (page.status !== 200) throw new Error(`authorize failed: ${page.status} ${await page.text()}`);
  const pageCookie = cookiesFrom(page, cookie);
  const res = await postConsent(
    worker,
    consentHandle(await page.text()),
    "approve",
    { ...access, Cookie: pageCookie },
    bindings,
  );
  if (res.status !== 302) throw new Error(`approve failed: ${res.status} ${await res.text()}`);
  return {
    location: res.headers.get("Location"),
    cookie: cookiesFrom(res, pageCookie),
    consentShown: true,
  };
}

export async function exchangeCode(worker: Worker, clientId: string, code: string, verifier: string) {
  return call(worker, "/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
      resource: MCP_URL,
    }).toString(),
  });
}

/** The whole flow; returns the tokens for `/mcp`. */
export async function connect(worker: Worker) {
  const { client_id } = await registerClient(worker);
  const { verifier, challenge } = await pkce();
  const { location } = await approve(worker, client_id, challenge);
  const code = new URL(location!).searchParams.get("code");
  if (!code) throw new Error("no code in the redirect");
  const res = await exchangeCode(worker, client_id, code, verifier);
  if (res.status !== 200) throw new Error(`token failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; refresh_token?: string };
  return { ...body, clientId: client_id };
}

let nextId = 1;

/** One JSON-RPC request to `/mcp` (2025 streamable HTTP, served statelessly). */
export async function mcp(worker: Worker, method: string, params: object = {}, token?: string) {
  return call(worker, "/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
}

/** Reads a JSON-RPC response whether it came back as JSON or as an SSE event. */
export async function rpcResult<T = unknown>(res: Response): Promise<{ result?: T; error?: unknown }> {
  const text = await res.text();
  if ((res.headers.get("Content-Type") ?? "").includes("text/event-stream")) {
    const data = text.split("\n").find((line) => line.startsWith("data:"));
    if (!data) throw new Error("no data event in the SSE response");
    return JSON.parse(data.slice(5));
  }
  return JSON.parse(text);
}
