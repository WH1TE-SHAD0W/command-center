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
npm run migrate:local -w api   # wrangler d1 migrations apply DB --local (applies api/migrations/)
npm run dev:api                # wrangler dev on :8787, local D1/R2 (Miniflare)
npm run dev:web                # astro dev on :4321; Vite proxies /api → :8787
```
Locally there is no Cloudflare Access, and every API route except the ADR 0007 machine paths
returns `401` without a valid `Cf-Access-Jwt-Assertion` header. Planned, not built yet: a dev-only
bypass in `auth.ts` that accepts a fixed owner actor **only when** `ENVIRONMENT=development` is set
in `api/.dev.vars` (git-ignored), with a test that a missing JWT returns 401 when it is unset.

To trigger the cron locally, run `npx wrangler dev --test-scheduled`, then
`curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"`.

## Schema changes (ADR 0013)
1. Edit the module's schema file, `api/src/schema/<module>.ts` (a new module also gets one
   `export * from "./<module>";` line in `api/src/schema/index.ts`).
2. `npm run migrations:generate -w api -- --name <what_changed>` writes the next numbered
   migration (`api/migrations/NNNN_<what_changed>.sql`) and updates `api/migrations/meta/`.
3. Review the SQL, especially table recreations, which SQLite needs for column changes.
4. `npm run migrate:local -w api` applies it to the local D1; tests apply it on their own.

Never edit an applied migration or `api/migrations/meta/` by hand. If `main` gained a migration
while your branch had one, drop yours (`npx -w api drizzle-kit drop`) and generate it again on top.

## Tests
- `npm test -w api`: Vitest with `@cloudflare/vitest-pool-workers`. Tests run inside workerd against
  a local D1 with all migrations applied, call the worker's `fetch`/`scheduled` or `createApp`
  directly, and forge Access JWTs with a key generated in the test (`api/test/helpers/access.ts`).
  The synthetic `CLOUDFLARE_ACCESS_*` values live in `api/vitest.config.ts`; the certs fetch is
  injected through `createApp(moduleList, { auth: { fetch } })`, so tests never touch the network.
- `npm test -w web`: Vitest + happy-dom for page scripts (as in džingel).
- One test per acceptance criterion; synthetic data only.

## Deploys

Cloudflare Workers Builds deploys both workers on every push to `main`. GitHub Actions only verifies
(typecheck, tests, web build) and holds no Cloudflare secrets. Each workspace has a `deploy` script
(`npm run deploy -w api`, `npm run deploy -w web`) that runs `wrangler deploy` with that worker's
own config. Only Workers Builds runs it; no agent and no CI job ever does.

- `api`: `wrangler deploy` bundles `src/worker.ts` with `api/wrangler.jsonc`.
- `web`: `astro build` writes the worker to `web/dist/server/` with a generated
  `dist/server/wrangler.json`, plus a redirect in `web/.wrangler/deploy/config.json`. A plain
  `wrangler deploy` in `web/` follows that redirect and ships the build output, so the script passes
  no `--config` (that would deploy the unbuilt source config instead).

Neither worker has a public address of its own: both set `workers_dev: false` and
`preview_urls: false` (no `*.workers.dev` URL, no Version URLs). The only way in is the custom domain
behind Cloudflare Access; the API is reachable only through the web worker's service binding.

### Owner checklist: first deploy

The owner does every step below; agents never create resources, deploy or apply remote migrations.
Do them in this order.

**1. Create the resources** (dashboard, or `npx wrangler …` from `api/`), then put their IDs in
`api/wrangler.jsonc`. Only replace the values named here; the `binding` names (`DB`, `FILES`,
`OAUTH_KV`) are what the code reads (`env.DB`, …) and must not change.

| Resource | Create with | In `api/wrangler.jsonc`, replace |
|---|---|---|
| D1 database | `npx wrangler d1 create <name>` | `d1_databases[0].database_name` (`command-center-db-local`) and `database_id` (`placeholder-d1-id`) |
| R2 bucket (private, ADR 0008) | `npx wrangler r2 bucket create <name>` | `r2_buckets[0].bucket_name` (`command-center-files-local`); R2 has no ID |
| KV namespace (OAuth state and the Access key cache) | `npx wrangler kv namespace create OAUTH_KV` | `kv_namespaces[0].id` (`placeholder-kv-id`) |

Commit that change through a PR like any other. The web worker binds no resources, only `API`
(the service binding to `command-center-api`) and `ASSETS`.

**2. Apply the D1 migrations to the remote database** (manual and reviewed, never part of a build):
review the SQL in `api/migrations/` that is not yet applied, then from `api/`:
```
npx wrangler d1 migrations list DB --remote    # what is pending
npx wrangler d1 migrations apply DB --remote
```
Repeat this before merging any later PR that adds a migration, so the code that needs a table never
reaches production before the table does.

**3. Connect the API worker to Workers Builds first** (Workers & Pages → Create → Import a
repository, or the worker's Settings → Build). The service binding needs `command-center-api` to
exist, so let its first build succeed before connecting the web worker.

| Setting | `command-center-api` | `command-center` |
|---|---|---|
| Worker name | `command-center-api` (must match `name` in `wrangler.jsonc`) | `command-center` |
| Root directory | `api` | `web` |
| Build command | `cd .. && npm ci` | `cd .. && npm ci && npm run build -w web` |
| Deploy command | `npm run deploy` | `npm run deploy` |
| Production branch (Branch control) | `main` | `main` |
| Enable Preview Builds | off | off |
| Build variables | `SKIP_DEPENDENCY_INSTALL=1` | `SKIP_DEPENDENCY_INSTALL=1` |

The repository is an npm workspace with one `package-lock.json` at the top, and the Workers Builds
docs do not say whether their automatic install finds it when the root directory is `api/` or `web/`.
The build commands therefore run `npm ci` from the repository root themselves, and
`SKIP_DEPENDENCY_INSTALL=1` turns the automatic install off so nothing is installed twice. Because
this monorepo behaviour is undocumented, read each worker's first build log once: it should show no
automatic install step and exactly one `npm ci`, run at the repository root. Build variables exist
only during the build, not at runtime.

**4. Set the API's Access variables** on `command-center-api`:
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: the team host, such as `<team>.cloudflareaccess.com` (`https://`
  and a trailing slash are accepted).
- `CLOUDFLARE_ACCESS_AUD`: the Application Audience (AUD) tag of the Access application from step 5.

Neither value is a secret, but neither belongs in this public repository. Two ways to set them:
- **As secrets** (survive every deploy): from `api/`, `npx wrangler secret put CLOUDFLARE_ACCESS_TEAM_DOMAIN`
  and `npx wrangler secret put CLOUDFLARE_ACCESS_AUD`, or Settings → Variables and Secrets → type
  *Secret*. Each `secret put` deploys a new version immediately.
- **As plaintext variables** in Settings → Variables and Secrets. `wrangler deploy` treats
  `wrangler.jsonc` as the source of truth and **deletes dashboard variables** on the next deploy
  unless `api/wrangler.jsonc` sets `"keep_vars": true`, so this option needs that line first.

Without both values every request except the ADR 0007 machine paths fails closed with
`500 {"error":"authentication is not configured"}`.

**5. Create the Access application before attaching the custom domain** (Zero Trust → Access →
Applications → Self-hosted, domain `app.culak.eu`):
- An *Allow* policy for the owner's identity only.
- A *Bypass* policy for exactly the ADR 0007 machine paths, where the OAuth token or the one-time
  token is the authentication: `/mcp`, `/token`, `/register`, `/.well-known/oauth-*` and
  `/uploads/*`. `/authorize` is **not** bypassed: it stays behind Access, so getting a token needs
  the owner's Access login.
- Copy the application's AUD tag into `CLOUDFLARE_ACCESS_AUD` (step 4).

**6. Connect the web worker** to Workers Builds with the settings in step 3, let its first build
succeed, and only then attach `app.culak.eu` as its custom domain (Settings → Domains & Routes). With
Access already in place the domain is never reachable without it.

### Every later deploy
- Merging to `main` builds and deploys both workers. Keep API changes backward compatible with the
  web worker that is live, because the two builds run independently.
- A PR that adds a migration: apply it remotely (step 2) before merging.
- Rollback: Workers & Pages → the worker → Deployments. Rolling back code does not roll back D1 data.
