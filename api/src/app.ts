import { Hono } from "hono";
import { modules as registeredModules, type Module } from "./modules";

export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
}

export type AppEnv = { Bindings: Bindings };

/**
 * Builds the API. Only the modules in `moduleList` are mounted; it defaults to
 * the explicit list in `modules.ts`, and tests pass their own.
 * Core routes are chained so that their types reach `AppType` (Hono RPC).
 */
export function createApp(moduleList: readonly Module[] = registeredModules) {
  const app = new Hono<AppEnv>().get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  for (const module of moduleList) {
    app.route("/", module.routes);
  }

  return app;
}

/** The API's route types, for the web worker's typed `hc` client (`web/src/lib/api.ts`). */
export type AppType = ReturnType<typeof createApp>;
