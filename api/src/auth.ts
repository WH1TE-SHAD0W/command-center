import { createMiddleware } from "hono/factory";
import {
  createLocalJWKSet,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from "jose";

/**
 * Cloudflare Access JWT validation (ADR 0003, issue #14).
 *
 * The edge already enforces Access; the API checks the `Cf-Access-Jwt-Assertion` header again
 * (defence in depth). Only the ADR 0007 machine paths skip it: they carry their own
 * authentication (OAuth bearer token, one-time upload token; issues #15 and #23).
 *
 * The API is stateless: the team's JWKS is cached in KV (`OAUTH_KV`), never in isolate memory.
 */

export interface AuthBindings {
  OAUTH_KV: KVNamespace;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
}

export interface AuthVariables {
  /** The verified Access JWT claims. */
  accessJwt: JWTPayload;
}

export interface AuthDeps {
  /** Used to fetch the team's certs; tests inject a local fake. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** The ADR 0007 Access bypass list. A test asserts it stays exactly this. */
export const ACCESS_BYPASS = {
  exact: ["/mcp", "/token", "/register"],
  prefixes: ["/.well-known/oauth-"],
  /** `/uploads/<one-time-token>`: exactly one non-empty path segment. */
  uploads: /^\/uploads\/[^/]+$/,
} as const;

export function isBypassPath(path: string): boolean {
  return (
    (ACCESS_BYPASS.exact as readonly string[]).includes(path) ||
    ACCESS_BYPASS.prefixes.some((prefix) => path.startsWith(prefix)) ||
    ACCESS_BYPASS.uploads.test(path)
  );
}

/** How long a cached JWKS lives in KV. */
export const JWKS_TTL_SECONDS = 3600;
/** An unknown `kid` refetches the certs at most this often (key rotation). */
export const JWKS_REFETCH_COOLDOWN_MS = 30_000;

interface CachedJwks {
  jwks: JSONWebKeySet;
  fetchedAt: number;
}

export const jwksCacheKey = (host: string) => `access:jwks:${host}`;

const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Accepts `team.cloudflareaccess.com` with or without `https://` and a trailing slash. */
export function normaliseTeamDomain(value: string | undefined): string | null {
  if (!value) return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/+$/, "");
  return HOST_PATTERN.test(host) ? host : null;
}

class JwksUnavailable extends Error {}

async function fetchJwks(host: string, kv: KVNamespace, fetchImpl: typeof fetch) {
  let res: Response;
  try {
    res = await fetchImpl(`https://${host}/cdn-cgi/access/certs`);
  } catch {
    throw new JwksUnavailable();
  }
  if (!res.ok) throw new JwksUnavailable();
  const body = (await res.json().catch(() => null)) as JSONWebKeySet | null;
  if (!body || !Array.isArray(body.keys)) throw new JwksUnavailable();
  const cached: CachedJwks = { jwks: { keys: body.keys }, fetchedAt: Date.now() };
  await kv.put(jwksCacheKey(host), JSON.stringify(cached), { expirationTtl: JWKS_TTL_SECONDS });
  return cached;
}

const unauthorized = { error: "unauthorized" } as const;

export function accessAuth(deps: AuthDeps = {}) {
  return createMiddleware<{ Bindings: AuthBindings; Variables: AuthVariables }>(
    async (c, next) => {
      if (isBypassPath(c.req.path)) return next();

      const host = normaliseTeamDomain(c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
      const audience = c.env.CLOUDFLARE_ACCESS_AUD?.trim();
      const kv = c.env.OAUTH_KV;
      if (!host || !audience || !kv) {
        // Fail closed and make the misconfiguration obvious.
        return c.json({ error: "authentication is not configured" }, 500);
      }

      const token = c.req.header("cf-access-jwt-assertion")?.trim();
      if (!token) return c.json(unauthorized, 401);

      const fetchImpl = deps.fetch ?? fetch;
      const verify = (cached: CachedJwks) =>
        jwtVerify(token, createLocalJWKSet(cached.jwks), {
          issuer: `https://${host}`,
          audience,
          algorithms: ["RS256"],
        });

      try {
        let cached = await kv.get<CachedJwks>(jwksCacheKey(host), "json");
        if (!cached) cached = await fetchJwks(host, kv, fetchImpl);
        let result;
        try {
          result = await verify(cached);
        } catch (err) {
          const rotated =
            err instanceof errors.JWKSNoMatchingKey &&
            Date.now() - cached.fetchedAt >= JWKS_REFETCH_COOLDOWN_MS;
          if (!rotated) throw err;
          result = await verify(await fetchJwks(host, kv, fetchImpl));
        }
        c.set("accessJwt", result.payload);
      } catch (err) {
        if (err instanceof JwksUnavailable) {
          return c.json({ error: "authentication is unavailable" }, 500);
        }
        return c.json(unauthorized, 401);
      }

      return next();
    },
  );
}
