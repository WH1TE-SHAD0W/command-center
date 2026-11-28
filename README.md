# command-center

A single-user personal command centre on Cloudflare Workers: one place that shows and controls its
owner's day-to-day systems. Life modules (a recipe menu, habits, nightly check-ins) and engineering
modules (uptime, background jobs, an ideas backlog) plug into one shared platform. Input comes from
the browser on a laptop and from Hermes Agent over MCP on the phone.

It is built by a software factory of AI agents under one human owner, from living specs: see
[docs/specs/factory.md](docs/specs/factory.md).

## What it can do

Everything below is built, tested and live. Each line is a requirement from the module's spec;
anything else is planned (see the [roadmap](docs/roadmap.md)).

### Platform ([spec](docs/specs/platform.md))
- **PLT-001** The API answers a health check
- **PLT-002** Every API request carries a valid Cloudflare Access JWT
- **PLT-003** Only the machine paths (MCP, OAuth, one-time uploads) skip the Access check
- **PLT-004** Only modules listed in the registry exist
- **PLT-005** No module imports another module's files
- **PLT-006** One shared Drizzle instance and one migrations folder
- **PLT-007** The MCP server at `/mcp` is protected by OAuth
- **PLT-008** `/authorize` needs the owner's Access login
- **PLT-009** The web worker is an Astro server app on Cloudflare
- **PLT-010** The home page shows the API's health
- **PLT-011** The web worker forwards only the Access JWT to the API
- **PLT-012** The web worker passes the machine paths through to the API

### Kitchen ([spec](docs/specs/kitchen.md))
- **KIT-001** Recipe types are a fixed list in menu order
- **KIT-002** Recipe tags are a fixed, extendable list

### Factory ([spec](docs/specs/factory.md))
How the app is built, as promises the factory keeps:
- **FAC-001** Every change is specified before it is built
- **FAC-002** Every requirement is proven by a test
- **FAC-003** Every change is reviewed against its spec before the owner sees it
- **FAC-004** The owner decides and merges; agents implement
- **FAC-005** The public docs always describe the app as it is today
- **FAC-006** The factory learns after every phase
- **FAC-007** Personal data never enters the repository
- **FAC-008** The whole factory is described in one place

## Docs

| | |
|---|---|
| [Guide](docs/guide/) | Quick start and how to use what is built |
| [Roadmap](docs/roadmap.md) | Every issue, what depends on what, and what can start next |
| [Specs](docs/specs/) | What each module must do, requirement by requirement |
| [docs/](docs/) | Architecture, data model, development, deploys and ADRs |
| [AGENTS.md](AGENTS.md) | How an agent works in this repository |

## Stack

Two Cloudflare Workers: an Astro server with Svelte islands (`web/`) that the browser talks to, and
a Hono API with an MCP server (`api/`) reached only over a service binding. D1 through Drizzle, R2
for images, Cloudflare Access in front of everything. npm and Wrangler only.
