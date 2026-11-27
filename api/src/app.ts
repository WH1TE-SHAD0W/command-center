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
 */
export function createApp(moduleList: readonly Module[] = registeredModules) {
  const app = new Hono<AppEnv>();

  app.get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  for (const module of moduleList) {
    app.route("/", module.routes);
  }

  return app;
}
