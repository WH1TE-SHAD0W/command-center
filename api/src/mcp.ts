import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Bindings } from "./app";
import type { McpContext, Module } from "./modules";
import type { OAuthProps } from "./oauth";

/**
 * The MCP server at `/mcp` (ADR 0007, issue #15). Streamable HTTP, stateless: every request gets
 * a fresh server with the tools of the listed modules, so nothing lives in isolate memory. The
 * OAuth provider (`oauth.ts`) has already validated the bearer token before a request gets here.
 */

export const MCP_SERVER_INFO = { name: "command-center", version: "1.0.0" } as const;

/** A server carrying the tools that each listed module registers from `src/mcp/<module>.ts`. */
export function buildMcpServer(moduleList: readonly Module[], context: McpContext): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, { capabilities: { tools: {} } });
  for (const module of moduleList) {
    module.mcp?.(server, context);
  }
  return server;
}

/** The provider's `apiHandler`: `ctx.props` holds what `/authorize` stored with the grant. */
export function mcpApiHandler(moduleList: readonly Module[]) {
  return {
    fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
      const props = (ctx as ExecutionContext & { props: OAuthProps }).props;
      const handler = createMcpHandler(() => buildMcpServer(moduleList, { env, props }));
      return handler.fetch(request);
    },
  };
}
