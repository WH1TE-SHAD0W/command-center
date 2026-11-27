import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    name: "workers",
    include: ["test/**/*.test.ts"],
    // The architecture check needs Node; it runs in vitest.architecture.config.ts.
    exclude: ["test/architecture/**", "node_modules/**"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
