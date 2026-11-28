import type { APIContext, MiddlewareNext } from "astro";
import { afterEach, describe, expect, it } from "vitest";
import { PASSTHROUGH, isPassthroughPath } from "../src/lib/passthrough";
import { onRequest } from "../src/middleware";
import { env } from "./stubs/cloudflare-workers";

const ORIGIN = "https://app.example.test";

/** A stub `API` binding that records exactly what it receives. */
function stubBinding() {
  const received: Request[] = [];
  const binding = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request && !init ? input : new Request(input, init);
      received.push(request);
      return new Response("from-api", { status: 299, headers: { "X-From": "api" } });
    },
  } as unknown as Fetcher;
  return { binding, received };
}

/** Runs the middleware for one request; `next` stands for Astro rendering a page. */
async function run(request: Request) {
  const { binding, received } = stubBinding();
  env.API = binding;
  let rendered = false;
  const next: MiddlewareNext = async () => {
    rendered = true;
    return new Response("astro-page");
  };
  const context = { request, url: new URL(request.url) } as APIContext;
  const res = (await onRequest(context, next)) as Response;
  return { res, received, rendered };
}

afterEach(() => {
  delete env.API;
});

describe("#15 the web worker forwards the MCP, OAuth and upload paths to the API", () => {
  describe("AC3: /mcp, /token, /register, /.well-known/oauth-*, /authorize and /uploads/* go over the binding unchanged", () => {
    it("the forwarded list is exactly these paths", () => {
      expect(PASSTHROUGH.exact).toEqual(["/mcp", "/token", "/register", "/authorize"]);
      expect(PASSTHROUGH.prefixes).toEqual(["/.well-known/oauth-"]);
      expect(PASSTHROUGH.uploads.source).toBe("^\\/uploads\\/[^/]+$");
    });

    const forwarded = [
      "/mcp",
      "/token",
      "/register",
      "/authorize",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource/mcp",
      "/uploads/synthetic-one-time-token",
    ];
    for (const path of forwarded) {
      it(`${path} is forwarded and the API's response comes back as it is`, async () => {
        const { res, received, rendered } = await run(new Request(`${ORIGIN}${path}?q=1`));
        expect(isPassthroughPath(path)).toBe(true);
        expect(rendered).toBe(false);
        expect(received).toHaveLength(1);
        expect(received[0].url).toBe(`${ORIGIN}${path}?q=1`);
        expect(res.status).toBe(299);
        expect(res.headers.get("X-From")).toBe("api");
        expect(await res.text()).toBe("from-api");
      });
    }

    it("keeps the method, every header and the body", async () => {
      const request = new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic-token",
          "Content-Type": "application/json",
          "Mcp-Protocol-Version": "2025-06-18",
          "X-Synthetic": "kept",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const { received } = await run(request);
      expect(received[0]).toBe(request);
      expect(received[0].method).toBe("POST");
      expect(received[0].headers.get("Authorization")).toBe("Bearer synthetic-token");
      expect(received[0].headers.get("X-Synthetic")).toBe("kept");
      expect(await received[0].json()).toEqual({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    });

    it("forwards the Access JWT on /authorize, which the API checks again", async () => {
      const request = new Request(`${ORIGIN}/authorize?client_id=synthetic`, {
        headers: { "Cf-Access-Jwt-Assertion": "synthetic.access.jwt" },
      });
      const { received } = await run(request);
      expect(received[0].headers.get("Cf-Access-Jwt-Assertion")).toBe("synthetic.access.jwt");
    });

    const rendered = [
      "/",
      "/api/health",
      "/mcp/",
      "/mcpx",
      "/authorize/x",
      "/uploads",
      "/uploads/",
      "/uploads/a/b",
      "/.well-known/openid-configuration",
      "/img/synthetic-key",
    ];
    for (const path of rendered) {
      it(`${path} is not forwarded; Astro handles it`, async () => {
        const result = await run(new Request(`${ORIGIN}${path}`));
        expect(isPassthroughPath(path)).toBe(false);
        expect(result.rendered).toBe(true);
        expect(result.received).toHaveLength(0);
        expect(await result.res.text()).toBe("astro-page");
      });
    }
  });
});
