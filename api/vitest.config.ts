import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Synthetic Access settings for tests only. Real values are set on the deployed worker.
          bindings: {
            CLOUDFLARE_ACCESS_TEAM_DOMAIN: "synthetic-team.example.test",
            CLOUDFLARE_ACCESS_AUD: "synthetic-aud-tag",
          },
        },
      },
    },
  },
});
