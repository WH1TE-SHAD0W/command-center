import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createWorker, type AppEnv } from "../src/app";
import type { Module } from "../src/modules";
import { PUBLIC_ORIGIN } from "../src/oauth";
import worker from "../src/worker";
import { TEST_SUB } from "./helpers/access";
import { call, connect, MCP_URL, mcp, rpcResult, workerFor } from "./helpers/oauth";

type ToolList = { tools: { name: string }[] };
type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

/** A synthetic listed module whose one tool echoes what its request context carries. */
const synthetic: Module = {
  name: "synthetic",
  routes: new Hono<AppEnv>(),
  mcp: (server, context) => {
    server.registerTool(
      "synthetic_whoami",
      {
        description: "Synthetic test tool",
        inputSchema: z.object({ word: z.string().max(20) }),
      },
      async ({ word }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              word,
              actor: context.props.actor,
              sub: context.props.sub,
              hasDb: Boolean(context.env.DB),
            }),
          },
        ],
      }),
    );
  },
};

/** Never in the module list passed to the worker, so its tool must not appear. */
const unlisted: Module = {
  name: "unlisted",
  routes: new Hono<AppEnv>(),
  mcp: (server) => {
    server.registerTool("unlisted_tool", { description: "never mounted" }, async () => ({
      content: [],
    }));
  },
};

describe("#15 Serve the MCP server at /mcp with workers-oauth-provider", () => {
  describe("AC1: the provider wraps /mcp and serves /token, /register and /.well-known/oauth-*", () => {
    it("the worker's default export is the OAuth provider", () => {
      expect(worker).toBeInstanceOf(OAuthProvider);
    });

    it("serves the authorization server metadata with our endpoints", async () => {
      const res = await call(workerFor(), "/.well-known/oauth-authorization-server");
      expect(res.status).toBe(200);
      const meta = (await res.json()) as Record<string, unknown>;
      expect(meta.issuer).toBe(PUBLIC_ORIGIN);
      expect(meta.authorization_endpoint).toBe(`${PUBLIC_ORIGIN}/authorize`);
      expect(meta.token_endpoint).toBe(`${PUBLIC_ORIGIN}/token`);
      expect(meta.registration_endpoint).toBe(`${PUBLIC_ORIGIN}/register`);
      expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    });

    it("serves the protected resource metadata for /mcp", async () => {
      const res = await call(workerFor(), "/.well-known/oauth-protected-resource/mcp");
      expect(res.status).toBe(200);
      const meta = (await res.json()) as Record<string, unknown>;
      expect(meta.resource).toBe(MCP_URL);
      expect(meta.authorization_servers).toEqual([PUBLIC_ORIGIN]);
    });

    it("registers a client dynamically at /register", async () => {
      const res = await call(workerFor(), "/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Synthetic Client",
          redirect_uris: ["http://127.0.0.1:8765/callback"],
          token_endpoint_auth_method: "none",
        }),
      });
      expect(res.status).toBe(201);
      expect(((await res.json()) as { client_id: string }).client_id).toEqual(expect.any(String));
    });

    it("answers /token itself: a bad code is an OAuth error, not the Access 401", async () => {
      const res = await call(workerFor(), "/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=synthetic-bad-code&client_id=synthetic",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/^invalid_/);
    });
  });

  describe("AC4: tools/list returns the tools registered by listed modules", () => {
    it("lists no tools with the default module list (none yet)", async () => {
      const defaultWorker = createWorker();
      const { access_token } = await connect(defaultWorker);
      const res = await mcp(defaultWorker, "tools/list", {}, access_token);
      expect(res.status).toBe(200);
      expect((await rpcResult<ToolList>(res)).result?.tools).toEqual([]);
    });

    it("lists a listed module's tools and not an unlisted module's", async () => {
      const listed = workerFor([synthetic]);
      const { access_token } = await connect(listed);
      const res = await mcp(listed, "tools/list", {}, access_token);
      const names = (await rpcResult<ToolList>(res)).result?.tools.map((tool) => tool.name);
      expect(names).toEqual(["synthetic_whoami"]);
      expect(names).not.toContain(unlisted.name + "_tool");
    });

    it("a module's tool gets the bindings and the grant's props", async () => {
      const listed = workerFor([synthetic]);
      const { access_token } = await connect(listed);
      const res = await mcp(
        listed,
        "tools/call",
        { name: "synthetic_whoami", arguments: { word: "hello" } },
        access_token,
      );
      const { result } = await rpcResult<ToolResult>(res);
      expect(JSON.parse(result!.content[0].text)).toEqual({
        word: "hello",
        actor: "owner",
        sub: TEST_SUB,
        hasDb: true,
      });
    });

    it("tool input is validated against the tool's schema", async () => {
      const listed = workerFor([synthetic]);
      const { access_token } = await connect(listed);
      const res = await mcp(
        listed,
        "tools/call",
        { name: "synthetic_whoami", arguments: { word: "x".repeat(21) } },
        access_token,
      );
      const { result, error } = await rpcResult<ToolResult>(res);
      expect(error ?? result?.isError).toBeTruthy();
    });
  });

  describe("AC5: /mcp accepts only a token issued after an Access-authenticated /authorize", () => {
    it("returns 401 on /mcp without a token, pointing at the resource metadata", async () => {
      const res = await mcp(workerFor([synthetic]), "tools/list");
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
    });

    it("returns 401 on /mcp with a made-up token", async () => {
      const res = await mcp(workerFor([synthetic]), "tools/list", {}, "synthetic:made:up");
      expect(res.status).toBe(401);
    });

    it("a token from register → Access-authenticated authorize → token lists the tools", async () => {
      const listed = workerFor([synthetic]);
      const { access_token, refresh_token } = await connect(listed);
      expect(refresh_token).toEqual(expect.any(String));
      const res = await mcp(listed, "tools/list", {}, access_token);
      expect(res.status).toBe(200);
      const names = (await rpcResult<ToolList>(res)).result?.tools.map((tool) => tool.name);
      expect(names).toEqual(["synthetic_whoami"]);
    });

    it("the token works on a fresh worker instance: OAuth state lives in KV", async () => {
      const { access_token } = await connect(workerFor([synthetic]));
      const res = await mcp(workerFor([synthetic]), "tools/list", {}, access_token);
      expect(res.status).toBe(200);
    });
  });
});
