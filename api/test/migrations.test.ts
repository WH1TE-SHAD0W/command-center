import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("PLT-006 #11 Drizzle and migrations", () => {
  it("AC2: every migration in api/migrations/ has drizzle-kit's numbered name, from 0000 without gaps", () => {
    const names = env.TEST_MIGRATIONS.map((m) => m.name);

    names.forEach((name, index) => {
      expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(Number(name.slice(0, 4))).toBe(index);
    });
  });

  it("AC3/AC4: the local D1 has every migration in api/migrations/ applied, in order", async () => {
    const { results } = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{
      name: string;
    }>();

    expect(results.map((r) => r.name)).toEqual(env.TEST_MIGRATIONS.map((m) => m.name));
  });
});
