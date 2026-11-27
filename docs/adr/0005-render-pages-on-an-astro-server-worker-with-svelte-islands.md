# 0005. Render pages on an Astro server worker with Svelte islands; the browser never calls the API

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** Owner's decisions on 2026-11-26: "C + B with Svelte"; "web worker is the Astro server
  while the API gives logic, all API connections are done within the server (like
  microservices)"; "service binding, only the API reads D1"; "Astro Actions… Astro-native with
  schema validation, no bloated routes" (2026-11-27). This replaces an earlier draft of
  0005 (static output, no framework) that was never accepted.

## Context
The app is a set of module pages, and some of them (the menu, the habit grid) are interactive. Its
data lives in D1 at runtime, so a static build cannot render it. The owner wants a clean split: the
web tier renders, and the API tier owns logic and data.

## Decision
`web/` is Astro with server output on Cloudflare Workers (`@astrojs/cloudflare`), and it is
deployed as the `command-center` worker. Pages render on the server, fetching their data from the
API worker **over the service binding** (`env.API`). Interactive parts are **Svelte** components
hydrated as islands. Every browser write is an **Astro Action** (`web/src/actions/`) with a zod
input schema. It is validated on the Astro server and then calls the API over the binding, so there
are no hand-made BFF routes. The browser talks only to the Astro worker and never calls the API
directly. The one pass-through is Hermes's traffic (`/mcp`, OAuth endpoints, `/uploads/*`), which
the Astro worker forwards unchanged to the API (ADR 0007). Only the API worker binds D1 and R2.

## Consequences
- Easy: pages arrive already filled with data (no loading states for the menu). The API stays the
  only gate to the data. Each tier deploys and scales on its own.
- Hard: every browser write goes browser → Action → binding → API, so input is validated twice (zod
  in the Action, then the API's own validation). The API's check is the authoritative one. A broken
  API binding means pages fail to render, so pages need a graceful error state.
- The web worker is Astro's generated worker, not a hand-written forwarder like džingel's
  `web/worker/index.ts`.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **Static Astro plus plain TypeScript per page (džingel's approach):** client-side fetches with
  DOM code written by hand; rejected by the owner.
- **SPA (React with Vite):** heavier, and it breaks the "browser never calls the API" split.
- **Astro reading D1 directly:** fewer hops, but two tiers would own the data.
