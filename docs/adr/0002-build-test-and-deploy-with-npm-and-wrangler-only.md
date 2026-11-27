# 0002. Build, test and deploy with npm and Wrangler only; run tests inside workerd

- **Status:** Accepted. The `Db` interface sentence is superseded by ADR 0010 (Drizzle).
- **Date:** 2026-11-26
- **Source:** Owner's decision on 2026-11-26: "use wrangler, the native Cloudflare build; Bun
  wouldn't be used at all"

## Context
The only production target is Cloudflare Workers, which run on workerd. džingel tests on Node with
`node:sqlite` because it also has a self-host path. command-center has no self-host path, so testing
on a different runtime than production would only add drift between the test runtime and D1.

## Decision
npm workspaces (`api`, `web`) with Wrangler v4 for everything that touches Cloudflare: `wrangler dev`
for local workers with local D1 and R2 (Miniflare), `wrangler d1 migrations` for the schema, and
Workers Builds for deploys. Tests use Vitest with `@cloudflare/vitest-pool-workers`, so they run
inside workerd against a real local D1, and migrations are applied before each test file. Routes
still use the `Db` interface. It now has a single D1 adapter, kept so that SQL access stays in one
place and the džingel pattern stays intact.

## Consequences
- Easy: tests see exactly what production sees (D1 semantics, bindings, `scheduled()`). There is
  one runtime to reason about. The copied `.claude/` hooks (`npm run typecheck -w api`,
  `npm test -w api`) work as they are.
- Hard: the workers pool is slower to start than an in-memory Node test. Vitest and the pool
  must be kept on versions that are compatible with each other.
- No `node:*` modules in application code beyond what `nodejs_compat` provides.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **Bun as toolchain or runtime:** dropped by the owner; production is not Bun.
- **Vitest on Node with `node:sqlite` (as in džingel):** faster startup, but it tests a different
  SQLite than D1 and exists there only because of the self-host path.
