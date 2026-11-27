# Development

> Target workflow (ADR 0002). Commands become real once the scaffold lands.

## Toolchain
- **npm workspaces** (`api`, `web`). `package-lock.json` is committed.
- **Wrangler v4** for local workers, local D1/R2, migrations and deploys. No Bun, no Node server.
- **Runtime is workerd** everywhere: `wrangler dev` locally, the Vitest workers pool in tests, and
  Cloudflare in production.

## Local dev
```
npm install
npm run migrate:local -w api   # wrangler d1 migrations apply command-center --local
npm run dev:api                # wrangler dev on :8787, local D1/R2 (Miniflare)
npm run dev:web                # astro dev on :4321; Vite proxies /api → :8787
```
Locally there is no Cloudflare Access, and every API route except the ADR 0007 machine paths
returns `401` without a valid `Cf-Access-Jwt-Assertion` header. Planned, not built yet: a dev-only
bypass in `auth.ts` that accepts a fixed owner actor **only when** `ENVIRONMENT=development` is set
in `api/.dev.vars` (git-ignored), with a test that a missing JWT returns 401 when it is unset.

To trigger the cron locally, run `npx wrangler dev --test-scheduled`, then
`curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"`.

## Tests
- `npm test -w api`: Vitest with `@cloudflare/vitest-pool-workers`. Tests run inside workerd against
  a local D1 with all migrations applied, call the worker's `fetch`/`scheduled` or `createApp`
  directly, and forge Access JWTs with a key generated in the test (`api/test/helpers/access.ts`).
  The synthetic `CLOUDFLARE_ACCESS_*` values live in `api/vitest.config.ts`; the certs fetch is
  injected through `createApp({ auth: { fetch } })`, so tests never touch the network.
- `npm test -w web`: Vitest + happy-dom for page scripts (as in džingel).
- One test per acceptance criterion; synthetic data only.

## Deploys
- Cloudflare Workers Builds is connected to this repo. On push to `main`:
  - `command-center-api` (root `api/`): apply remote D1 migrations, then `wrangler deploy`.
  - `command-center` (root `web/`): `astro build`, then `wrangler deploy`.
- GitHub Actions (`.github/workflows/ci.yml`): `npm ci`, typecheck, tests, web build. It holds no
  Cloudflare secrets.
- Secrets and vars (`CLOUDFLARE_ACCESS_AUD`, `CLOUDFLARE_ACCESS_TEAM_DOMAIN`, the alert channel
  token) go in with `wrangler secret put`, never in the repo. The team domain is the host, such as
  `<team>.cloudflareaccess.com` (`https://` and a trailing slash are accepted).
