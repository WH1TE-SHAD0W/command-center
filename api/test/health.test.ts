import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { makeKey, seedJwks, signToken, TEST_TEAM_DOMAIN } from "./helpers/access";

describe("Health check", () => {
  it("GET /api/health returns 200 with { ok: true } for a valid Access JWT", async () => {
    // Seed the KV cache so the worker never reaches out for the (synthetic) team's certs.
    const key = await makeKey("health-kid");
    await seedJwks(env.OAUTH_KV, TEST_TEAM_DOMAIN, [key.publicJwk]);

    const res = await SELF.fetch("http://localhost/api/health", {
      headers: { "Cf-Access-Jwt-Assertion": await signToken(key) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("GET /api/health without an Access JWT returns 401", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(401);
  });
});
