import { Hono } from "hono";

export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
}

export function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  app.get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  return app;
}
