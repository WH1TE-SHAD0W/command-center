import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Index from "../src/pages/index.astro";
import { env } from "./stubs/cloudflare-workers";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(webDir, path), "utf8");

/** wrangler.jsonc with its whole-line `//` comments removed. */
function wranglerConfig() {
  const text = read("wrangler.jsonc")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(text) as Record<string, unknown>;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(webDir, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("PLT-009 #10 scaffold the Astro web worker", () => {
  it("is an Astro server app on the Cloudflare adapter with Svelte, served on :4321", () => {
    // Read as text: importing the config pulls the adapter into the test's Vite graph.
    const config = read("astro.config.mjs");
    expect(config).toMatch(/output:\s*"server"/);
    expect(config).toMatch(/import cloudflare from "@astrojs\/cloudflare"/);
    expect(config).toMatch(/adapter:\s*cloudflare\(/);
    expect(config).toMatch(/import svelte from "@astrojs\/svelte"/);
    expect(config).toMatch(/integrations:\s*\[svelte\(\)\]/);
    expect(config).toMatch(/server:\s*\{\s*port:\s*4321\s*\}/);
    const rootScripts = JSON.parse(read("../package.json")).scripts;
    expect(rootScripts["dev:web"]).toBe("npm run dev -w web");
  });

  it("binds API to command-center-api and declares no D1 or R2 binding", () => {
    const config = wranglerConfig();
    expect(config.name).toBe("command-center");
    expect(config.services).toEqual([{ binding: "API", service: "command-center-api" }]);
    expect(config).not.toHaveProperty("d1_databases");
    expect(config).not.toHaveProperty("r2_buckets");
  });

  it("loads no external fonts, CDNs or analytics", async () => {
    env.API = { fetch: async () => Response.json({ ok: true }) } as unknown as Fetcher;
    const html = await (await AstroContainer.create()).renderToString(Index);
    delete env.API;
    expect(html).not.toMatch(/(src|href)=["']?(https?:)?\/\//i);
    expect(html).not.toMatch(/@import|url\(\s*["']?(https?:)?\/\//i);

    for (const file of sourceFiles("src")) {
      const text = read(file);
      expect(text, file).not.toMatch(/<link[^>]+href=["']?(https?:)?\/\//i);
      expect(text, file).not.toMatch(/<script[^>]+src=["']?(https?:)?\/\//i);
      expect(text, file).not.toMatch(/@import|url\(\s*["']?(https?:)?\/\//i);
    }
  });

  it("uses the void-black #09090b background with monospace accents", () => {
    const layout = read("src/layouts/Base.astro");
    expect(layout).toMatch(/--bg:\s*#09090b/i);
    expect(layout).toMatch(/background:\s*var\(--bg\)/);
    expect(layout).toMatch(/--mono:[^;]*monospace/);
    expect(read("src/pages/index.astro")).toContain('<Base title="Dashboard">');
  });
});
