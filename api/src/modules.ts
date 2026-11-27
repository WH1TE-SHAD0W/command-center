import type { Hono } from "hono";
import type { AppEnv } from "./app";

/**
 * One entry per module (ADR 0011 rule 2), the equivalent of Laravel's
 * `bootstrap/providers.php`. A module's routes exist only if it is listed in
 * `modules` below; `createApp` mounts nothing else.
 *
 * `routes` is the module's group from `routes.ts`, the one router, e.g.
 * `{ name: "kitchen", routes: kitchenRoutes }`. Paths inside a group are
 * absolute (`/api/kitchen/recipes`).
 */
export interface Module {
  name: string;
  routes: Hono<AppEnv>;
}

/** The explicit module list. Add a module here, and remove it here. */
export const modules: readonly Module[] = [];
