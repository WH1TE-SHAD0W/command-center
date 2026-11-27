import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createApp, type AppEnv } from "../src/app";
import type { Module } from "../src/modules";

const synthetic: Module = {
  name: "synthetic",
  routes: new Hono<AppEnv>().get("/api/synthetic/ping", (c) => c.json({ pong: true })),
};

describe("#12 module registry", () => {
  it("AC1: a listed module's routes are mounted", async () => {
    const res = await createApp([synthetic]).request("/api/synthetic/ping");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
  });

  it("AC1: an unlisted module's routes do not exist", async () => {
    const res = await createApp([]).request("/api/synthetic/ping");
    expect(res.status).toBe(404);
  });

  it("AC1: by default only modules.ts is mounted, and core routes stay up", async () => {
    const app = createApp();
    expect((await app.request("/api/synthetic/ping")).status).toBe(404);
    expect((await app.request("/api/health")).status).toBe(200);
  });
});
