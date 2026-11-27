// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Images are served by the API (ADR 0008), so the web worker needs no IMAGES binding.
    imageService: "passthrough",
  }),
  integrations: [svelte()],
  // No Astro sessions, so the adapter adds no SESSION KV binding.
  session: false,
  server: { port: 4321 },
});
