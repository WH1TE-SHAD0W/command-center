/**
 * Paths the web worker hands to the API untouched (ADR 0007, issue #15): Hermes's MCP endpoint,
 * the OAuth endpoints served by the API's `workers-oauth-provider`, the consent page and the
 * one-time upload URLs. The API keeps no public hostname, so this is their only way in.
 *
 * Mirrors the API's Access bypass list (`api/src/auth.ts`) plus `/authorize`, which stays behind
 * Access and is checked again by the API.
 */
export const PASSTHROUGH = {
  exact: ["/mcp", "/token", "/register", "/authorize"],
  prefixes: ["/.well-known/oauth-"],
  /** `/uploads/<one-time-token>`: exactly one non-empty path segment. */
  uploads: /^\/uploads\/[^/]+$/,
} as const;

export function isPassthroughPath(path: string): boolean {
  return (
    (PASSTHROUGH.exact as readonly string[]).includes(path) ||
    PASSTHROUGH.prefixes.some((prefix) => path.startsWith(prefix)) ||
    PASSTHROUGH.uploads.test(path)
  );
}

/**
 * Sends the incoming request over the `API` service binding as it is: same method, URL, headers
 * (including `Authorization` and `Cf-Access-Jwt-Assertion`) and body, and returns the API's
 * response as it is.
 */
export function forwardToApi(request: Request, api: Fetcher): Promise<Response> {
  return api.fetch(request);
}
