import { defineConfig } from "drizzle-kit";

// The one drizzle-kit config (ADR 0013). It reads every module's schema file and writes numbered
// migrations (0000_<name>.sql) into migrations/, the folder Wrangler applies.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/*.ts",
  out: "./migrations",
  migrations: { prefix: "index" },
});
