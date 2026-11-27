import { applyD1Migrations, env } from "cloudflare:test";

// Runs before every test file: the local D1 gets everything in api/migrations/ (ADR 0013).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
