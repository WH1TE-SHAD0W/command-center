import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Health check", () => {
  it("GET /api/health returns 200 with { ok: true }", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
