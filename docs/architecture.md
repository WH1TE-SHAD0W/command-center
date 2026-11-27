# Architecture

> Target design. Nothing is scaffolded yet; update this file as the code lands.

## Deployed pieces

| Piece | Where | Role |
|---|---|---|
| `command-center` worker | `web/` | Astro server (`@astrojs/cloudflare`) with Svelte islands. Renders every page; gets data from the API over the service binding `API`. No D1 binding (ADR 0005) |
| `command-center-api` worker | `api/` | Hono app plus the MCP server at `/mcp` (ADR 0007). The only worker bound to D1, R2 and Queues. `workers_dev: false`; Hermes reaches it through the Astro worker's pass-through |
| Cloudflare Queues | on the API worker | Background jobs (ADR 0011); free plan: 10,000 operations a day, 24-hour retention |
| D1 `command-center` | binding `DB` | All structured data, accessed through Drizzle; tables prefixed per module (ADR 0010) |
| R2 bucket | binding `FILES` on the API worker | Recipe photos. **Private**; served at `/img/<key>` and resized with the Images binding (ADR 0008). Instagram media stays in the existing `img.lynxmedia.ie` bucket, owned by Hermes |
| KV namespace | binding `OAUTH_KV` on the API worker | OAuth state for `workers-oauth-provider` (ADR 0007) |
| Cron Trigger | on the API worker | External health checks every 5 min; daily pruning |
| Cloudflare Access app | `app.culak.eu` | Owner login and service tokens for machine clients |
| LAN probe | home lab | Checks `172.16.x.x` services and pushes results |
| Hermes | home lab | Nous Research's Hermes Agent, used through Telegram. The phone input channel; calls the MCP server (ADRs 0006, 0007) |

## Request flow

```
Owner browser
  └─▶ Cloudflare Access (SSO)  ── sets CF_Authorization cookie
        └─▶ command-center (Astro server worker)
              ├─ static asset? → serve from the Astro build
              └─ page          → render on the server; data via env.API.fetch(...)  (service binding)
                                   └─▶ command-center-api → accessAuth → routes.ts → controller → service → Drizzle → D1
              ├─ write         → Svelte island calls an Astro Action (zod) → env.API.fetch(...)
              └─ /img/<key>    → forwarded to the API → R2 + Images binding → cached response

Hermes (phone input)
  └─▶ https://app.culak.eu/mcp  (Access bypass; OAuth bearer token)
        └─▶ Astro worker forwards unchanged over the binding
              └─▶ command-center-api /mcp → workers-oauth-provider → module tools → same module functions → D1 / R2
  First connection: /authorize stays behind Access → owner signs in → token issued (ADR 0007)
  Photo: request_upload tool → one-time /uploads/<token> → Hermes PUTs bytes → API streams into R2

LAN probe
  └─▶ POST .../api/ingest/checks with an Access service token  (to be revisited in the watchtower section)
```

The API re-validates the `Cf-Access-Jwt-Assertion` header (signature, `aud`, issuer) on every
request using `@hono/cloudflare-access` or a small `jose` check. It then sets
`c.get("actor")` to `{ kind: "owner" | "service", id }`. Ingest routes accept only `service`; UI
routes accept only `owner`.

## Repository layout (ADR 0011, Laravel-style: split by type, one file per module)

```
package.json                  npm workspaces: api, web
api/
  wrangler.jsonc              DB, FILES, OAUTH_KV, queues, triggers.crons; migrations_dir = d1-migrations
  migrations/<module>/        drizzle-kit output per module, timestamp names   (ADR 0010)
  d1-migrations/              collected from migrations/*, what Wrangler applies; never hand-edited
  src/
    worker.ts                 fetch + scheduled + queue handlers; wires env
    app.ts                    createApp: middleware (Access JWT, deps) + router + /mcp
    routes.ts                 THE one router              ≈ routes/api.php
    modules.ts                explicit module list        ≈ bootstrap/providers.php
    auth.ts                   Access JWT middleware, actor type
    controllers/<m>.ts        HTTP usage only             ≈ Http/Controllers
    services/<m>.ts           the logic; only place that queries  ≈ Services / Actions
    schema/<m>.ts             Drizzle tables + relations  ≈ Models
    validation/<m>.ts         zod from drizzle-zod        ≈ Http/Requests
    mcp/<m>.ts                MCP tools, usage only       ≈ Mcp/Tools
    events/                   typed event definitions     ≈ Events
    listeners/<m>.ts          reactions to other modules' events  ≈ Listeners
    jobs/                     Cloudflare Queues consumers ≈ Jobs
    schedule.ts               cron entries                ≈ routes/console.php
    enums/<name>.ts           one fixed list per file     ≈ Enums
    kinds/<m>/<kind>.ts       interface implementations   ≈ Manager drivers
    connectors/<domain>/<provider>.ts   swappable providers  ≈ Socialite providers
  test/                       vitest + @cloudflare/vitest-pool-workers (workerd, local D1)
web/
  astro.config.mjs            output: "server", adapter @astrojs/cloudflare, integration @astrojs/svelte
  wrangler.jsonc              service binding API → command-center-api (no D1)
  src/lib/api.ts              typed hc<AppType> client over env.API
  src/layouts/Base.astro      nav + theme, shared by every page
  src/pages/                  the one web router: index.astro (dashboard), pages/<m>/…
  src/actions/index.ts        merges actions/<m>.ts (Astro Actions, zod)
  src/components/ui/          shared component library ("one style")
  src/components/dashboard/   one widget per module (server islands)
  src/components/<m>/         module-specific components
```

**Files per module** (kitchen as the example): `schema/kitchen.ts`, `validation/kitchen.ts`,
`services/kitchen.ts`, `controllers/kitchen.ts`, `mcp/kitchen.ts`, `enums/recipe-type.ts`,
`migrations/kitchen/`, entries in `routes.ts` and `modules.ts`; web: `pages/kitchen/`,
`actions/kitchen.ts`, `components/kitchen/`, `components/dashboard/kitchen.astro`.

## Module rules (ADR 0011)

```ts
// api/src/services/kitchen.ts: logic; the only place that queries
export const searchRecipes = (db: KitchenDb, q: SearchQuery) =>
  db.query.recipes.findMany({ where: active(recipes), with: { photos: true } });

// api/src/controllers/kitchen.ts: usage only
export const listRecipes = factory.createHandlers(zValidator("query", SearchQuery), async (c) =>
  c.json(await searchRecipes(c.var.db, c.req.valid("query"))));

// api/src/routes.ts: the one router
export const routes = new Hono<AppEnv>()
  .get("/api/kitchen/recipes", ...kitchen.listRecipes)
  .post("/api/kitchen/recipes", ...kitchen.createRecipe);
```

- Controllers, MCP tools, Actions, listeners and jobs call services; they never query.
- No module imports another module's files; they talk through typed events (synchronous), and
  background work goes on Queues. An architecture test enforces this.
- The dashboard renders one server-island widget per listed module, each fetching its own
  summary endpoint.

## Ingest contract (LAN probe; the Hermes rows are superseded)

> Since ADR 0007, Hermes writes through MCP tools, not these endpoints. The `job-runs`, `ideas` and
> `checkins` rows become MCP tools when those modules are defined. Only `checks` (the LAN probe)
> may stay an HTTP endpoint.

| Endpoint | Sender | Body (JSON) |
|---|---|---|
| `POST /api/ingest/checks` | LAN probe | `{ checks: [{ target, ok, latency_ms, checked_at }] }` |
| `POST /api/ingest/job-runs` | Hermes | `{ external_id, job, status, started_at, finished_at, summary }` |
| `POST /api/ingest/ideas` | Hermes | `{ external_id, captured_at, source, tags[], raw }` |
| `POST /api/ingest/checkins` | Hermes | `{ external_id, date, answers: {...} }` |

Rules: `content-type: application/json` only; size-capped; `external_id` makes a retry a no-op
(`INSERT ... ON CONFLICT(external_id) DO NOTHING`); response `{ accepted, duplicate }`. Free text
(`raw`, `summary`, `answers`) is stored but **never logged**.

## Scheduled work (`scheduled()` in `worker.ts`)

| Cron | Job |
|---|---|
| `*/5 * * * *` | HTTP(S) checks of public endpoints → `checks` rows |
| `0 3 * * *` | Prune `checks` older than 30 days; mark a LAN target `stale` if no push for 15 min |

Entries live in `api/src/schedule.ts`; the `scheduled()` handler dispatches them. Each entry calls
a service function, the same as routes do. These examples belong to the watchtower module, which
is not defined yet.
