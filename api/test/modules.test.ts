import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp, type AppEnv } from "../src/app";
import type { Module } from "../src/modules";
import { accessHeaders } from "./helpers/access";

const synthetic: Module = {
  name: "synthetic",
  routes: new Hono<AppEnv>().get("/api/synthetic/ping", (c) => c.json({ pong: true })),
};

/** Every route sits behind the Access check (#14), so requests carry a valid synthetic JWT. */
async function get(app: ReturnType<typeof createApp>, path: string) {
  return app.request(path, { headers: await accessHeaders(env.OAUTH_KV) }, env);
}

describe("#12 module registry", () => {
  it("AC1: a listed module's routes are mounted", async () => {
    const res = await get(createApp([synthetic]), "/api/synthetic/ping");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  it("AC1: an unlisted module's routes do not exist", async () => {
    const res = await get(createApp([]), "/api/synthetic/ping");
    expect(res.status).toBe(404);
  });

  it("AC1: by default only modules.ts is mounted, and core routes stay up", async () => {
    const app = createApp();
    expect((await get(app, "/api/synthetic/ping")).status).toBe(404);
    expect((await get(app, "/api/health")).status).toBe(200);
  });

  it("#14: a listed module's routes are behind the Access check", async () => {
    const res = await createApp([synthetic]).request("/api/synthetic/ping", {}, env);
    expect(res.status).toBe(401);
  });
});
