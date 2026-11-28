import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Two projects, one `npm test -w api`:
// - workers: everything in test/, inside workerd with a local D1 (ADR 0002)
// - architecture: the dependency-cruiser check, on Node because it reads the file tree
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest(async () => {
            // Read api/migrations/ in Node; test/apply-migrations.ts applies them to the local D1 in workerd.
            const migrations = await readD1Migrations(
              fileURLToPath(new URL("./migrations", import.meta.url)),
            );

            return {
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  // Synthetic Access settings for tests only. Real values are set on the deployed worker.
                  CLOUDFLARE_ACCESS_TEAM_DOMAIN: "synthetic-team.example.test",
                  CLOUDFLARE_ACCESS_AUD: "synthetic-aud-tag",
                },
              },
            };
          }),
        ],
        test: {
          name: "workers",
          include: ["test/**/*.test.ts"],
          // The architecture check needs Node; it runs in vitest.architecture.config.ts.
          exclude: ["test/architecture/**", "node_modules/**"],
          setupFiles: ["./test/apply-migrations.ts"],
        },
      },
      "./vitest.architecture.config.ts",
    ],
  },
});
