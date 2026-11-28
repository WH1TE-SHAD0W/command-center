import type { McpServer } from "@modelcontextprotocol/server";
import type { Hono } from "hono";
import type { AppEnv, Bindings } from "./app";
import type { OAuthProps } from "./oauth";

/** What a module's MCP tools get for one request: the worker's bindings and the token's props. */
export interface McpContext {
  env: Bindings;
  props: OAuthProps;
}

/**
 * Registers a module's MCP tools on a fresh server, once per `/mcp` request (ADR 0007). It lives
 * in `src/mcp/<module>.ts` and only calls the module's service, e.g.
 * `export function registerKitchenTools(server, context) { server.registerTool(...) }`.
 */
export type McpRegistrar = (server: McpServer, context: McpContext) => void;

/**
 * One entry per module (ADR 0011 rule 2), the equivalent of Laravel's
 * `bootstrap/providers.php`. A module's routes and MCP tools exist only if it
 * is listed in `modules` below; `createApp` and `/mcp` use nothing else.
 *
 * `routes` is the module's group from `routes.ts`, the one router, e.g.
 * `{ name: "kitchen", routes: kitchenRoutes, mcp: registerKitchenTools }`.
 * Paths inside a group are absolute (`/api/kitchen/recipes`).
 */
export interface Module {
  name: string;
  routes: Hono<AppEnv>;
  /** The module's MCP tools, from `src/mcp/<module>.ts`. Omit when it has none. */
  mcp?: McpRegistrar;
}

/** The explicit module list. Add a module here, and remove it here. */
export const modules: readonly Module[] = [];
