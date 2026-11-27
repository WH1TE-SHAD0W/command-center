import { Hono } from "hono";
import { accessAuth, type AuthBindings, type AuthDeps, type AuthVariables } from "./auth";

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

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<AppEnv>();

  // Every request passes the Access JWT check, except the ADR 0007 bypass paths.
  app.use("*", accessAuth(deps.auth));

  app.get("/api/health", (c) => {
    return c.json({ ok: true });
  });

  return app;
}
