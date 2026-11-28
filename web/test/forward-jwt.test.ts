import { readFileSync } from "node:fs";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { apiClient, getApiHealth } from "../src/lib/api";
import Index from "../src/pages/index.astro";
import { env } from "./stubs/cloudflare-workers";

/** Synthetic values only (AC4): none of these is a real Access token. */
const SYNTHETIC_ASSERTION = "synthetic.access-jwt.issue-40";
const SYNTHETIC_COOKIE = "CF_Authorization=synthetic-cookie-40";
const SYNTHETIC_AUTHORIZATION = "Bearer synthetic-bearer-40";

type Handler = (request: Request) => Response | Promise<Response>;

/** A stub service binding that records the requests it receives. */
function stubBinding(handler: Handler) {
  const requests: Request[] = [];
  const binding = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return handler(request);
    },
    connect: () => {
      throw new Error("not used");
    },
  } as unknown as Fetcher;
  return { binding, requests };
}

/** Behaves like the API since #14: 200 only with the expected assertion, 401 otherwise. */
const accessCheckingApi: Handler = (request) =>
  request.headers.get("cf-access-jwt-assertion") === SYNTHETIC_ASSERTION
    ? Response.json({ ok: true })
    : Response.json({ error: "unauthorized" }, { status: 401 });

/** An incoming browser request as Cloudflare Access hands it to the web worker. */
function incomingRequest(assertion: string | null, extra: Record<string, string> = {}) {
  const headers = new Headers(extra);
  if (assertion !== null) headers.set("Cf-Access-Jwt-Assertion", assertion);
  return new Request("https://app.test/", { headers });
}

const clientHeaders = {
  cookie: SYNTHETIC_COOKIE,
  authorization: SYNTHETIC_AUTHORIZATION,
  "x-forwarded-for": "192.0.2.40",
  "cf-connecting-ip": "192.0.2.40",
  "user-agent": "synthetic-agent/40",
  "accept-language": "sk",
};

async function renderIndex(binding: Fetcher, request: Request) {
  env.API = binding;
  const container = await AstroContainer.create();
  return container.renderToString(Index, { request });
}

afterEach(() => {
  delete env.API;
  vi.restoreAllMocks();
});

describe("#40 forward the Access JWT from the web worker to the API", () => {
  describe("AC1: forward the Access assertion unchanged, and nothing else", () => {
    it("forwards the incoming Cf-Access-Jwt-Assertion header unchanged over the binding", async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      await getApiHealth(binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(requests).toHaveLength(1);
      expect(requests[0].headers.get("cf-access-jwt-assertion")).toBe(SYNTHETIC_ASSERTION);
    });

    it("forwards the value byte for byte, without trimming or re-encoding it", async () => {
      // Header values cannot keep leading/trailing whitespace, so test the inner characters.
      const odd = "a.b-c_d=e.f+g/h";
      const { binding, requests } = stubBinding(accessCheckingApi);
      await apiClient(binding, incomingRequest(odd)).api.health.$get();
      expect(requests[0].headers.get("cf-access-jwt-assertion")).toBe(odd);
    });

    it("forwards no other client headers", async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      await getApiHealth(binding, incomingRequest(SYNTHETIC_ASSERTION, clientHeaders));
      const sent = [...requests[0].headers.keys()];
      for (const name of Object.keys(clientHeaders)) expect(sent).not.toContain(name);
      expect(sent).toEqual(["cf-access-jwt-assertion"]);
    });

    it("sends no assertion header when the incoming request has none", async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      await getApiHealth(binding, incomingRequest(null, clientHeaders));
      expect(requests).toHaveLength(1);
      expect(requests[0].headers.has("cf-access-jwt-assertion")).toBe(false);
      expect([...requests[0].headers.keys()]).toEqual([]);
    });

    it("forwards the header of each incoming request, not of an earlier one", async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      await getApiHealth(binding, incomingRequest("synthetic.first"));
      await getApiHealth(binding, incomingRequest(null));
      await getApiHealth(binding, incomingRequest("synthetic.second"));
      expect(requests.map((r) => r.headers.get("cf-access-jwt-assertion"))).toEqual([
        "synthetic.first",
        null,
        "synthetic.second",
      ]);
    });
  });

  describe("AC2: the index page with and without an assertion", () => {
    it('shows "API ok" when the incoming request carries a valid assertion', async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      const html = await renderIndex(binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(requests).toHaveLength(1);
      expect(requests[0].headers.get("cf-access-jwt-assertion")).toBe(SYNTHETIC_ASSERTION);
      expect(html).toContain("API ok");
      expect(html).toContain('data-state="ok"');
    });

    it("shows the error card when the incoming request has no assertion", async () => {
      const { binding } = stubBinding(accessCheckingApi);
      const html = await renderIndex(binding, incomingRequest(null));
      expect(html).toContain('data-state="error"');
      expect(html).toContain("The API answered with status 401.");
      expect(html).not.toContain("API ok");
    });

    it("shows the error card when the API rejects the assertion", async () => {
      const { binding } = stubBinding(accessCheckingApi);
      const html = await renderIndex(binding, incomingRequest("synthetic.rejected"));
      expect(html).toContain('data-state="error"');
      expect(html).not.toContain("API ok");
    });

    it("still renders the page when the binding call throws", async () => {
      const { binding } = stubBinding(() => {
        throw new Error("synthetic binding failure");
      });
      const html = await renderIndex(binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(html).toContain('data-state="error"');
      expect(html).toContain("The API could not be reached.");
    });
  });

  describe("AC3: the assertion is never logged and goes only to the binding", () => {
    const consoleSpies: MockInstance[] = [];
    let fetchSpy: MockInstance;

    beforeEach(() => {
      consoleSpies.length = 0;
      for (const method of ["log", "info", "warn", "error", "debug", "trace"] as const) {
        consoleSpies.push(vi.spyOn(console, method).mockImplementation(() => {}));
      }
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        throw new Error("global fetch must not be called");
      });
    });

    function loggedText() {
      return consoleSpies.flatMap((spy) => spy.mock.calls.flat().map((arg) => String(arg))).join("\n");
    }

    it("does not log the assertion on success, on a 401 or on a failure", async () => {
      const ok = stubBinding(accessCheckingApi);
      await renderIndex(ok.binding, incomingRequest(SYNTHETIC_ASSERTION));
      const rejected = stubBinding(() => new Response("unauthorized", { status: 401 }));
      await renderIndex(rejected.binding, incomingRequest(SYNTHETIC_ASSERTION));
      const failing = stubBinding(() => {
        throw new Error("synthetic binding failure");
      });
      await renderIndex(failing.binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(loggedText()).not.toContain(SYNTHETIC_ASSERTION);
    });

    it("does not put the assertion in the rendered page or its error message", async () => {
      const { binding } = stubBinding(() => new Response("unauthorized", { status: 401 }));
      const html = await renderIndex(binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(html).not.toContain(SYNTHETIC_ASSERTION);
    });

    it("sends the assertion only through the service binding, never through global fetch", async () => {
      const { binding, requests } = stubBinding(accessCheckingApi);
      await renderIndex(binding, incomingRequest(SYNTHETIC_ASSERTION));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(requests).toHaveLength(1);
      expect(new URL(requests[0].url).pathname).toBe("/api/health");
    });

    it("has no logging calls in the client or the page", () => {
      for (const file of ["../src/lib/api.ts", "../src/pages/index.astro"]) {
        const text = readFileSync(new URL(file, import.meta.url), "utf8");
        expect(text, file).not.toMatch(/console\./);
      }
    });
  });
});
