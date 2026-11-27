# docs/ — how command-center works

`context.md` (repo root) says **what** we build and **why**. This folder says **how**.

| File | Contents |
|---|---|
| [architecture.md](architecture.md) | Workers, request flow, repo layout, module pattern, ingest contract, cron |
| [data-model.md](data-model.md) | D1 tables per module (draft) |
| [roadmap.md](roadmap.md) | Every GitHub issue, its dependencies, and what can start now |
| [workflow.md](workflow.md) | Issues → branches → PRs; the owner merges (agents: see `/AGENTS.md`) |
| [development.md](development.md) | npm + Wrangler, local dev, tests in workerd, deploys |
| [adr/](adr/) | Architecture Decision Records: one decision per file, never rewritten (supersede instead) |

## ADR index
| # | Decision | Status |
|---|---|---|
| [0001](adr/0001-use-two-cloudflare-workers-hono-api-and-astro-web.md) | Two Cloudflare Workers: a Hono API behind a service binding, and an Astro web worker | Accepted |
| [0002](adr/0002-build-test-and-deploy-with-npm-and-wrangler-only.md) | npm and Wrangler only; tests run inside workerd | Accepted |
| [0003](adr/0003-authenticate-with-cloudflare-access.md) | Authenticate the owner and machine clients with Cloudflare Access | Accepted |
| [0004](adr/0004-push-lan-and-hermes-data-into-ingest-endpoints.md) | LAN and Hermes data is pushed into `/api/ingest/*`, never pulled | Proposed |
| [0005](adr/0005-render-pages-on-an-astro-server-worker-with-svelte-islands.md) | Pages render on an Astro server worker with Svelte islands; the browser never calls the API | Accepted |
| [0006](adr/0006-use-hermes-agent-as-the-mobile-input-channel.md) | Hermes Agent is the input channel on the phone; the browser on the laptop | Accepted |
| [0007](adr/0007-serve-an-mcp-server-from-the-api-worker-with-oauth.md) | The API worker serves an MCP server at `/mcp`, secured with OAuth | Accepted |
| [0008](adr/0008-keep-images-in-a-private-r2-bucket-served-through-the-app.md) | Images live in a private R2 bucket, served and resized through the app | Accepted |
| [0009](adr/0009-never-delete-records-archive-them.md) | Nothing is ever deleted; records are archived | Accepted |
| [0010](adr/0010-use-drizzle-with-per-module-schemas-and-migrations.md) | Drizzle, with a schema file and a migrations folder per module | Accepted (migrations part superseded by 0013) |
| [0011](adr/0011-organise-the-api-as-decoupled-modules-in-a-laravel-style-layout.md) | Decoupled modules in a Laravel-style layout | Accepted (M13 open) |
| [0013](adr/0013-generate-all-drizzle-migrations-into-one-folder.md) | All Drizzle migrations in one folder from one combined schema; one shared Drizzle instance | Accepted |

The question-and-answer record behind these decisions: [`context/brainstorm-log.md`](../context/brainstorm-log.md).
