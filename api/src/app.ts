import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { accessAuth, type AuthBindings, type AuthDeps, type AuthVariables } from "./auth";
import { mcpApiHandler } from "./mcp";
import { modules as registeredModules, type Module } from "./modules";
import { authorizeRoutes, oauthOptions, type OAuthBindings } from "./oauth";

export interface Bindings extends AuthBindings, OAuthBindings {
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
 * Core routes are chained so that their types reach `AppType` (Hono RPC).
 */
export function createApp(
  moduleList: readonly Module[] = registeredModules,
  deps: AppDeps = {},
) {
  const app = new Hono<AppEnv>()
    // Every request passes the Access JWT check, except the ADR 0007 bypass paths.
    .use("*", accessAuth(deps.auth))
    .get("/api/health", (c) => {
      return c.json({ ok: true });
    });

  // The OAuth consent page; behind the Access check like every non-bypass path (ADR 0007).
  app.route("/", authorizeRoutes());

  for (const module of moduleList) {
    app.route("/", module.routes);
  }

  return app;
}

/**
 * The whole worker: `workers-oauth-provider` in front of the Hono app (ADR 0007). It serves
 * `/token`, `/register` and `/.well-known/oauth-*`, sends `/mcp` with a valid bearer token to
 * the MCP server, and everything else (including `/authorize`) to `createApp`.
 */
export function createWorker(
  moduleList: readonly Module[] = registeredModules,
  deps: AppDeps = {},
) {
  const app = createApp(moduleList, deps);
  return new OAuthProvider<Bindings>({
    ...oauthOptions,
    apiHandler: mcpApiHandler(moduleList),
    defaultHandler: {
      fetch: (request, env, ctx) => app.fetch(request as Request, env, ctx),
    },
  });
}

/** The API's route types, for the web worker's typed `hc` client (`web/src/lib/api.ts`). */
export type AppType = ReturnType<typeof createApp>;
