import type { MiddlewareHandler } from "astro";
import { env } from "cloudflare:workers";
import { forwardToApi, isPassthroughPath } from "./lib/passthrough";

/**
 * The MCP, OAuth and upload paths go straight to the API over the binding, before any page or
 * route runs (ADR 0007). Everything else is rendered by Astro as usual.
 */
export const onRequest: MiddlewareHandler = (context, next) => {
  if (isPassthroughPath(context.url.pathname)) {
    return forwardToApi(context.request, env.API);
  }
  return next();
};
