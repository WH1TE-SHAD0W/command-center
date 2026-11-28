import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterEach, describe, expect, it } from "vitest";
import { getApiHealth } from "../src/lib/api";
import Index from "../src/pages/index.astro";
import { env } from "./stubs/cloudflare-workers";

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

const healthy: Handler = () => Response.json({ ok: true });

async function renderIndex(binding: Fetcher) {
  env.API = binding;
  const container = await AstroContainer.create();
  return container.renderToString(Index);
}

afterEach(() => {
  delete env.API;
});

describe("PLT-010 #10 the index page calls /api/health over the binding", () => {
  it("calls GET /api/health through the API binding with the typed client", async () => {
    const { binding, requests } = stubBinding(healthy);
    expect(await getApiHealth(binding, new Request("https://app.test/"))).toEqual({ ok: true });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
    expect(new URL(requests[0].url).pathname).toBe("/api/health");
  });

  it("reports an error when the API answers with a non-2xx status", async () => {
    const { binding } = stubBinding(() => new Response("unavailable", { status: 503 }));
    expect(await getApiHealth(binding, new Request("https://app.test/"))).toEqual({
      ok: false,
      error: "The API answered with status 503.",
    });
  });

  it("reports an error when the API says it is not ok", async () => {
    const { binding } = stubBinding(() => Response.json({ ok: false }));
    expect(await getApiHealth(binding, new Request("https://app.test/"))).toEqual({
      ok: false,
      error: "The API reported it is not ok.",
    });
  });

  it("reports an error, without throwing, when the binding call fails", async () => {
    const { binding } = stubBinding(() => {
      throw new Error("synthetic binding failure");
    });
    expect(await getApiHealth(binding, new Request("https://app.test/"))).toEqual({
      ok: false,
      error: "The API could not be reached.",
    });
  });

  it('shows "API ok" when the health call succeeds', async () => {
    const { binding, requests } = stubBinding(healthy);
    const html = await renderIndex(binding);
    expect(requests).toHaveLength(1);
    expect(html).toContain("API ok");
    expect(html).toContain('data-state="ok"');
    expect(html).not.toContain('data-state="error"');
  });

  it("shows an error card when the health call fails", async () => {
    const { binding } = stubBinding(() => new Response("unavailable", { status: 500 }));
    const html = await renderIndex(binding);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("The API answered with status 500.");
    expect(html).not.toContain("API ok");
  });

  it("does not leak the binding's error message into the page", async () => {
    const { binding } = stubBinding(() => {
      throw new Error("synthetic internal detail");
    });
    const html = await renderIndex(binding);
    expect(html).toContain("The API could not be reached.");
    expect(html).not.toContain("synthetic internal detail");
  });
});
