import { Hono } from "hono";
import { accessAuth, type AuthBindings, type AuthDeps, type AuthVariables } from "./auth";
import { modules as registeredModules, type Module } from "./modules";

export interface Bindings extends AuthBindings {
  DB: D1Database;
  FILES: R2Bucket;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: AuthVariables;
}

export interface AppDeps {
  auth?: AuthDeps;
}

/**
 * Builds the API. Only the modules in `moduleList` are mounted; it defaults to
 * the explicit list in `modules.ts`, and tests pass their own. `deps` lets tests
 * replace outside calls (the Access certs fetch).
 */
export function createApp(
  moduleList: readonly Module[] = registeredModules,
  deps: AppDeps = {},
) {
  const app = new Hono<AppEnv>();

  // Every request passes the Access JWT check, except the ADR 0007 bypass paths.
  app.use("*", accessAuth(deps.auth));

  app.get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  for (const module of moduleList) {
    app.route("/", module.routes);
  }

  return app;
}
