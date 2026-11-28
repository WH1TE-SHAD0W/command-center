import { fileURLToPath } from "node:url";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  // Read api/migrations/ in Node; test/apply-migrations.ts applies them to the local D1 in workerd.
  const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));

  return {
    test: {
      name: "workers",
      include: ["test/**/*.test.ts"],
      // The architecture check needs Node; it runs in vitest.architecture.config.ts.
      exclude: ["test/architecture/**", "node_modules/**"],
      setupFiles: ["./test/quiet-import-warnings.ts", "./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              // Synthetic Access settings for tests only. Real values are set on the deployed worker.
              CLOUDFLARE_ACCESS_TEAM_DOMAIN: "synthetic-team.example.test",
              CLOUDFLARE_ACCESS_AUD: "synthetic-aud-tag",
            },
          },
        },
      },
    },
  };
});
