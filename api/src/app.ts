import { Hono } from "hono";

export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
}

export function createApp() {
  // Routes are chained so that their types reach `AppType` (Hono RPC).
  const app = new Hono<{ Bindings: Bindings }>().get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  return app;
}

/** The API's route types, for the web worker's typed `hc` client (`web/src/lib/api.ts`). */
export type AppType = ReturnType<typeof createApp>;
