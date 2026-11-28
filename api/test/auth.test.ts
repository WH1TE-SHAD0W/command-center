import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp, type Bindings } from "../src/app";
import { ACCESS_BYPASS, isBypassPath, jwksCacheKey, JWKS_REFETCH_COOLDOWN_MS } from "../src/auth";
import {
  fakeCertsFetch,
  makeKey,
  seedJwks,
  signToken,
  TEST_AUD,
  uniqueHost,
  type TestKey,
} from "./helpers/access";

const testEnv: Bindings = env;

/** An app wired to a fresh synthetic team host, with a counting fake for the certs URL. */
async function setup(opts: { keys?: TestKey[]; envOverrides?: Partial<Bindings> } = {}) {
  const host = uniqueHost();
  const key = await makeKey("kid-1");
  const keys = opts.keys ?? [key];
  const certs = fakeCertsFetch(() => keys.map((k) => k.publicJwk));
  const app = createApp([], { auth: { fetch: certs.fetch } });
  const bindings: Bindings = {
    ...testEnv,
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: host,
    CLOUDFLARE_ACCESS_AUD: TEST_AUD,
    ...opts.envOverrides,
  };
  const request = (path: string, token?: string) =>
    app.request(
      path,
      { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} },
      bindings,
    );
  return { host, key, app, certs, bindings, request };
}

describe("#14 Validate the Cloudflare Access JWT on every API request", () => {
  describe("AC1: a request without Cf-Access-Jwt-Assertion gets 401", () => {
    it("returns 401 with a generic error when the header is missing", async () => {
      const { request, certs } = await setup();
      const res = await request("/api/health");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      expect(certs.calls).toHaveLength(0);
    });

    it("returns 401 when the header is empty", async () => {
      const { request } = await setup();
      const res = await request("/api/health", "   ");
      expect(res.status).toBe(401);
    });
  });

  describe("AC2: a bad signature, wrong aud, wrong issuer or past expiry gets 401", () => {
    it("rejects a token signed by a different key with the same kid", async () => {
      const { request, host } = await setup();
      const forger = await makeKey("kid-1");
      const res = await request("/api/health", await signToken(forger, { host }));
      expect(res.status).toBe(401);
    });

    it("rejects a token for another application (wrong aud)", async () => {
      const { request, host, key } = await setup();
      const token = await signToken(key, { host, audience: "another-synthetic-aud" });
      expect((await request("/api/health", token)).status).toBe(401);
    });

    it("rejects a token from another team (wrong issuer)", async () => {
      const { request, host, key } = await setup();
      const token = await signToken(key, { host, issuer: "https://other-team.example.test" });
      expect((await request("/api/health", token)).status).toBe(401);
    });

    it("rejects an expired token", async () => {
      const { request, host, key } = await setup();
      const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
      const token = await signToken(key, { host, expiresAt: oneMinuteAgo });
      expect((await request("/api/health", token)).status).toBe(401);
    });

    it("rejects an unsigned (alg: none) token", async () => {
      const { request, host } = await setup();
      const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1000);
      const token = `${b64({ alg: "none", kid: "kid-1" })}.${b64({
        iss: `https://${host}`,
        aud: TEST_AUD,
        exp: now + 300,
      })}.`;
      expect((await request("/api/health", token)).status).toBe(401);
    });

    it("rejects a malformed token", async () => {
      const { request } = await setup();
      expect((await request("/api/health", "not-a-jwt")).status).toBe(401);
    });
  });

  describe("AC3: a valid JWT passes and the JWKS is cached, not fetched on every request", () => {
    it("lets a valid token through and exposes its claims", async () => {
      const { request, host, key } = await setup();
      const res = await request("/api/health", await signToken(key, { host }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("fetches the certs once for many requests and caches them in KV", async () => {
      const { request, host, key, certs } = await setup();
      const token = await signToken(key, { host });
      for (let i = 0; i < 3; i++) {
        expect((await request("/api/health", token)).status).toBe(200);
      }
      expect(certs.calls).toEqual([`https://${host}/cdn-cgi/access/certs`]);
      expect(await testEnv.OAUTH_KV.get(jwksCacheKey(host))).not.toBeNull();
    });

    it("keeps no state in the isolate: a second app instance reuses the KV cache", async () => {
      const first = await setup();
      const token = await signToken(first.key, { host: first.host });
      expect((await first.request("/api/health", token)).status).toBe(200);

      const second = fakeCertsFetch(() => []);
      const app = createApp([], { auth: { fetch: second.fetch } });
      const res = await app.request(
        "/api/health",
        { headers: { "Cf-Access-Jwt-Assertion": token } },
        first.bindings,
      );
      expect(res.status).toBe(200);
      expect(second.calls).toHaveLength(0);
    });

    it("refetches the certs when a rotated key is unknown and the cache is old enough", async () => {
      const oldKey = await makeKey("kid-old");
      const newKey = await makeKey("kid-new");
      const { request, host, certs } = await setup({ keys: [oldKey, newKey] });
      await seedJwks(
        testEnv.OAUTH_KV,
        host,
        [oldKey.publicJwk],
        Date.now() - JWKS_REFETCH_COOLDOWN_MS - 1,
      );
      const res = await request("/api/health", await signToken(newKey, { host }));
      expect(res.status).toBe(200);
      expect(certs.calls).toHaveLength(1);
    });

    it("does not refetch for an unknown kid within the cooldown", async () => {
      const oldKey = await makeKey("kid-old");
      const strangerKey = await makeKey("kid-unknown");
      const { request, host, certs } = await setup({ keys: [oldKey] });
      await seedJwks(testEnv.OAUTH_KV, host, [oldKey.publicJwk]);
      const res = await request("/api/health", await signToken(strangerKey, { host }));
      expect(res.status).toBe(401);
      expect(certs.calls).toHaveLength(0);
    });
  });

  describe("AC4: only the ADR 0007 machine paths skip the check", () => {
    it("the bypass list is exactly the ADR 0007 list", () => {
      expect(ACCESS_BYPASS.exact).toEqual(["/mcp", "/token", "/register"]);
      expect(ACCESS_BYPASS.prefixes).toEqual(["/.well-known/oauth-"]);
      expect(ACCESS_BYPASS.uploads.source).toBe("^\\/uploads\\/[^/]+$");
    });

    const bypassed = [
      "/mcp",
      "/token",
      "/register",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/uploads/synthetic-one-time-token",
    ];
    for (const path of bypassed) {
      it(`${path} skips the Access check (its own auth comes in #15/#23)`, async () => {
        const { request } = await setup();
        const res = await request(path);
        expect(isBypassPath(path)).toBe(true);
        expect(res.status).not.toBe(401);
      });
    }

    const checked = [
      "/api/health",
      "/authorize",
      "/mcp/",
      "/mcp/sse",
      "/mcpx",
      "/MCP",
      "/token/",
      "/register/x",
      "/uploads",
      "/uploads/",
      "/uploads/a/b",
      "/.well-known/openid-configuration",
      "/.well-known/oauth",
      "/img/synthetic-key",
      "/",
    ];
    for (const path of checked) {
      it(`${path} does not skip the Access check`, async () => {
        const { request } = await setup();
        expect(isBypassPath(path)).toBe(false);
        expect((await request(path)).status).toBe(401);
      });
    }

    it("a path that normalises out of a bypass prefix is still checked", async () => {
      const { request } = await setup();
      expect((await request("/uploads/../api/health")).status).toBe(401);
      expect((await request("/.well-known/oauth-x/../../api/health")).status).toBe(401);
    });
  });

  describe("configuration", () => {
    it("fails closed with 500 when the team domain is not set", async () => {
      const { request, host, key } = await setup({
        envOverrides: { CLOUDFLARE_ACCESS_TEAM_DOMAIN: undefined },
      });
      const res = await request("/api/health", await signToken(key, { host }));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "authentication is not configured" });
    });

    it("fails closed with 500 when the AUD is not set", async () => {
      const { request, host, key } = await setup({
        envOverrides: { CLOUDFLARE_ACCESS_AUD: "" },
      });
      expect((await request("/api/health", await signToken(key, { host }))).status).toBe(500);
    });

    it("accepts the team domain with https:// and a trailing slash", async () => {
      const host = uniqueHost();
      const { request, key } = await setup({
        envOverrides: { CLOUDFLARE_ACCESS_TEAM_DOMAIN: `https://${host}/` },
      });
      expect((await request("/api/health", await signToken(key, { host }))).status).toBe(200);
    });

    it("returns 500 when the certs cannot be fetched", async () => {
      const host = uniqueHost();
      const key = await makeKey("kid-1");
      const app = createApp([], {
        auth: { fetch: (async () => new Response("down", { status: 503 })) as typeof fetch },
      });
      const res = await app.request(
        "/api/health",
        { headers: { "Cf-Access-Jwt-Assertion": await signToken(key, { host }) } },
        { ...testEnv, CLOUDFLARE_ACCESS_TEAM_DOMAIN: host, CLOUDFLARE_ACCESS_AUD: TEST_AUD },
      );
      expect(res.status).toBe(500);
    });
  });
});
