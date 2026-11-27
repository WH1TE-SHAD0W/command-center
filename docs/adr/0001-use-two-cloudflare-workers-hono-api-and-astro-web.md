# 0001. Use two Cloudflare Workers: a Hono API behind a service binding, and an Astro web worker

- **Status:** Accepted. The "no ORM / `Db` interface" part is superseded by ADR 0010 (Drizzle);
  the web worker's role is refined by ADR 0005.
- **Date:** 2026-11-26
- **Source:** Owner's instruction on 2026-11-26 ("use džingel's architecture; API on a Cloudflare
  Worker using Hono"); `../dzingel/docs/adr/0001-*`, `0002-*`, `0008-*`

## Context
command-center needs an API, a dashboard UI and a small relational store, on infrastructure the
owner already runs (Cloudflare, domain `culak.eu`). džingel already proves a shape that works on
that stack and that the agent team in `.claude/` is built around.

## Decision
`api/` is a Hono app built by `createApp(db, deps)`, deployed as the `command-center-api` worker
with `workers_dev: false`. `web/` is Astro, deployed as the `command-center` worker, which serves
static assets and forwards `/api/*` over a service binding. Data lives in D1 and is accessed only
through the `Db` interface; files live in R2. There is no ORM, migrations are plain numbered SQL,
and Cloudflare Workers Builds deploys on push to `main` while GitHub Actions only verifies.

## Consequences
- Easy: the API has no public surface of its own. Routes are testable without workerd. The same agent
  team, rules and hooks apply.
- Hard: D1 is SQLite (single writer, no long transactions; batch for multi-statement writes). The
  two builds deploy independently, so API changes must stay backward compatible for one deploy.
- The worker cannot reach the home LAN (see ADR 0004).

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **One worker serving both assets and API:** simpler, but it loses the "API not public" property
  and diverges from džingel.
- **Cloudflare Pages + Functions:** the portfolio uses Pages, but Workers with static assets is
  Cloudflare's current recommendation and matches džingel.
