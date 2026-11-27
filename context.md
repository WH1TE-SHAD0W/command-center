# command-center — project context

> What we are building and why. Read this before planning any work. `docs/` explains *how* the code
> does it; GitHub Issues hold the individual tickets. Status: **draft from the brainstorm of
> 2026-11-26** — items marked *Proposed* are not decided until they have an ADR in `docs/adr/`.

## 1. What it is

A **single-user personal command centre** served at `app.culak.eu`. One place that shows and
controls the owner's day-to-day systems:

- **Life modules:** habits, a recipe menu of the dishes the owner has cooked, nightly check-ins.
- **Engineering modules:** uptime and health of home-lab and external services, the status of
  background automations, and a backlog of problems and ideas collected at meetups.

It is **not** multi-tenant and has **no public sign-up**. There is exactly one human user (the
owner) plus a few **machine clients** (Hermes, the LAN probe) that push data in.

**It is meant to grow.** The owner will keep adding parts of their personal digital life: other
kinds of dashboards, new features, and integrations. Examples kept in mind but **not planned**: a
Garmin watch and an IP camera. The code must therefore be **clean, adaptable and robust module by
module**. A new module or integration is added without changing existing ones, and new *types*
(habit kinds, schedule types, recipe types…) are added without reworking the code around them.

## 2. Actors

| Actor | What it does | How it authenticates (ADR 0003) |
|---|---|---|
| **Owner** | Uses the dashboard in a browser | Cloudflare Access (Zero Trust) in front of `app.culak.eu` |
| **Hermes** | Nous Research's **Hermes Agent**, self-hosted, used through Telegram. The owner's main input channel on the phone; it also runs the cron jobs and nightly check-ins | Custom **MCP server** on the API worker, OAuth via `workers-oauth-provider` (ADR 0007) |
| **LAN probe** | A small process inside the `172.16.x.x` network that checks local services and pushes results | Access service token → `POST /api/ingest/checks` |
| **Worker cron** | Cloudflare Cron Trigger on the API worker: checks external endpoints, prunes old data | Runs inside the worker; no HTTP auth |

## 3. Architecture in one picture

```
 Browser ─HTTPS─▶ Cloudflare Access ─▶ [ web worker: Astro server + Svelte islands ]
                                                │ service binding only (microservice-style)
                                                ▼
 Hermes ─── MCP (OAuth) ───────────────▶ [ api worker: Hono + /mcp ]──▶ D1  (only the API touches it)
 LAN probe ─ HTTPS (service token) ────▶       │  cron trigger    ──▶ R2  (images)
                                                └──▶ external HTTP health checks

 Hermes's /mcp, OAuth and /uploads traffic enters through the Astro worker, which forwards it to
 the API over the binding (Access bypass on those paths only; see §6). How the LAN probe gets in is
 still open (watchtower section).
```

Copied from **džingel** (`../dzingel`, see `context/architecture.md` there):

- **Two workers.** `command-center-api` (Hono, `api/`) has `workers_dev: false` and is reachable
  only through the **service binding** from `command-center` (Astro, `web/`). The browser never
  calls the API worker directly.
- **`createApp(...)` factory.** All routes live in a Hono app; `worker.ts` wires the real bindings
  and tests wire a local D1.
- **Never edit an applied migration**; add a new one.
- **Deploys with Cloudflare Workers Builds** on push to `main`. GitHub Actions only verifies
  (typecheck, tests, build) and holds no Cloudflare secrets.

Different from džingel:

- **Cloudflare-native only.** npm and Wrangler, no Bun and no Node self-host path. Tests run inside
  workerd against a local D1 (`@cloudflare/vitest-pool-workers`), not on `node:sqlite`. Decided,
  ADR 0002.
- **Astro server with Svelte islands** (`@astrojs/cloudflare`), one page per module. The web worker
  is the only thing the browser talks to. It reaches the API only over the service binding, and
  only the API touches D1. Decided, ADR 0005.
- **Hermes is the input channel** on the phone; the browser is the input channel on the laptop.
  Decided, ADR 0006.
- **MCP server on the API worker** (`/mcp`, OAuth via `workers-oauth-provider`). It starts with a
  small set of tools, and each module adds its own. Decided, ADR 0007.
- **No Better Auth / no users table.** Identity comes from Cloudflare Access, and the API checks the
  `Cf-Access-Jwt-Assertion` JWT on every request. Decided, ADR 0003.
- **Drizzle** instead of raw SQL. Each module has its own schema file and migrations folder;
  migrations are collected for Wrangler and reviewed before they are applied. Decided, ADR 0010.
- **Decoupled modules in a Laravel-style layout** (split by type, one file per module), with these
  rules (ADR 0011):
  - **Registry:** modules are listed explicitly.
  - **Routing:** one router, with a controller per module.
  - **Logic vs usage:** services hold the logic; controllers, MCP tools and Actions only use it.
  - **Communication:** no module imports another; they use synchronous events, and background jobs
    go on Queues. An architecture test enforces this.
  - **Types:** kinds with behaviour sit behind interfaces; fixed lists are one enum file each.
  - **Connectors:** swappable providers under a module (e.g. Garmin under `fitness`).
  - **Dashboard:** one widget per module, built from a shared component library.
  - Removing or replacing one module must not affect the others.
- **Planned future modules** (not scheduled): `character` (points and levels from habits and
  others), `fitness` (with a Garmin connector).
- **Cron Triggers and push ingestion**, because some data originates outside Cloudflare (the LAN,
  the Hermes host).

## 4. The hard constraint: the worker cannot see the LAN

Cloudflare Workers run on Cloudflare's edge. They **cannot** reach `172.16.x.x`, TrueNAS, local SSH
daemons or files under `/opt/data/` on the Hermes host, and they cannot send ICMP pings.
Therefore:

- **Local data is pushed in, not pulled.** Hermes calls MCP tools, and the LAN probe posts to the
  API. The API stores the data and the dashboard reads it from D1.
- **The worker does only what is reachable from the internet itself**: HTTP(S) checks of public
  endpoints and scheduled housekeeping.
- Alternative for later: Cloudflare Tunnel with Workers VPC, which would let the worker call private
  services. Not needed for the MVP. Record an ADR if it is ever adopted.

## 5. Modules and the issues behind them

| # | Issue | Module | Where the work happens |
|---|---|---|---|
| 5 | Habit tracker | `habits` + character | **This repo**: habits, character stats and points, heatmaps (see §5.2). Issue #5 still says "streak counters"; streaks are now optional and separate |
| 6 | Kitchen recipe menu | `kitchen` | **This repo**: recipe catalogue, menu and recipe pages, MCP tools for Hermes (see §5.1) |
| 3 | Meetup problem survey and architecture pipeline | `ideas` | Intake in **Hermes** (Telegram); API `POST /api/ingest/ideas` and the backlog UI live **here** |
| 2 | Uptime Watchtower | `watchtower` | Probe on the **LAN**; external checks by the **worker cron**; API and status widget **here** |
| 1 | Cron automations (Instagram, Confluence backup, nightly check-ins) | `jobs`, `checkins` | The jobs run in **Hermes** and report through **MCP**; the status widget and check-in history are **here**. The "Shadow Profile" is Hermes's own profile of the owner for better chats: it lives in **Hermes**, not here |
| 4 | Portfolio redesign | none | **Separate repo** (`WH1TE-SHAD0W/portfolio`, Cloudflare Pages). At most a public `/status` feed from this API |

Cross-module links: nightly check-ins (#1) feed the habit tracker (#5). The watchtower's live status
(#2) can back the portfolio's "Live System Status" banner (#4), through a separate public, read-only,
heavily cached endpoint.

### 5.1 Kitchen (#6), defined 2026-11-26

- **What:** a catalogue of the recipes the owner has cooked, shown as a **browsable,
  restaurant-style menu**. Tapping a dish opens the full recipe. There is **no meal plan and no
  grocery list**.
- **Who sees it:** only the owner for now. Guests are the intent for later (open item, §8).
- **Fields:** name, type, servings, tags, source link, ingredients, photos, and optional steps.
  - **type**, a fixed list that is crucial for the menu: starter, soup, main, side, dessert,
    breakfast, snack, drink, sauce.
  - **ingredients**, as JSON: `[{ name, amount, unit, note }]`.
  - **tags**, from a fixed list. Whether Hermes can assign them automatically is an open item (§8).
  - **steps**, optional. A recipe holds whatever the owner put into it, and the recipe page shows
    all of it.
- **How dishes get in:** mostly through Hermes. Example: the owner finishes bryndzové halušky, sends
  Hermes a photo with the dish name or a link, and Hermes reads the link and asks follow-up
  questions on the spot. Then it calls the MCP tools. The photo is uploaded through a one-time URL
  from the `request_upload` tool and stored in R2.
- **Duplicates:** Hermes stops the owner from creating a dish that already exists, and the API
  enforces this too. `create_recipe` refuses a recipe whose name matches an existing one (ignoring
  case and accents) and points to the existing recipe. A new entry is allowed only for a genuinely
  different variant (uncommon); how variants are marked is an open item (§8). Cooking a dish again
  adds a photo to the existing recipe. There is no cooked log at this stage.
- **Search** ignores accents and covers name, tags and ingredients (D1 full-text search, FTS5).
- **Nothing is deleted**: recipes are archived, never removed (ADR 0009).

### 5.2 Habits and the character (#5), defined 2026-11-26

- **Purpose: personal development.** The owner is represented by a **character** with up to **6
  stats**. Candidates are finance, physical strength, mind power and community; the final set is not
  decided.
- **Habits feed stats.** Each habit feeds **one or several stats, with weights**, set per habit.
  Points level up the character's stats. How points per level grow is open (§8).
- **Habit kinds:** yes/no, and counted with a target (e.g. 8 glasses). **Schedules** are set per
  habit (every day, specific weekdays, N times a week…). Both lists must be easy to extend.
- **No streaks for now.** The core view is a **GitHub-style heatmap per character stat**, showing how
  often it was developed. Streaks may come back later as an optional, separate feature.
- **Input:** on the phone, the owner tells Hermes, which calls MCP. On the laptop, they tick in the
  browser. Later, habits tie into a personal to-do list (open item, not designed).
- **The day:** it ends when the owner submits the nightly check-in (Hermes handles this). If no
  check-in arrives, the day ends at a **03:00 cutoff, Europe/Dublin**, so late-night entries count
  for the day they belong to.
- **Nothing is deleted**: habits are archived, because past points still reference them (ADR 0009).

### 5.3 Nightly check-ins (#1), partly defined 2026-11-26

- Hermes asks at 23:30, and every answer reaches command-center **through MCP**.
- Check-in answers **tick habits automatically**.
- The content will be redesigned to be **low-friction**: no metaphor prompts. The format is left
  for the end of the brainstorm (§8).

## 6. Non-functional rules

- **Privacy: the repo is public.** Habits, check-in reflections, meals and travel are personal data.
  Never put real entries in issues, commits, fixtures, seed files or logs. Use synthetic data only
  (the `pii-sanitizer` skill applies).
- **Everything is behind Access** except an explicit, documented bypass list. Today that list is
  only the machine paths Hermes uses: `/mcp`, `/token`, `/register`, `/.well-known/oauth-*` and
  `/uploads/<one-time-token>`, where the OAuth token or the one-time token is the authentication.
  `/authorize` stays behind Access, so the only way to get a token is your Access login. The API
  validates the Access JWT itself as well; the edge check alone is not enough (defence in depth).
- **Nothing is ever deleted**, anywhere in the app. Records are archived (ADR 0009).
- **Ingest endpoints are idempotent**: the client sends an `external_id`, and a retried push must not
  create duplicates.
- **Validate every input server-side** with parameterised SQL. Render user content through
  Svelte's or Astro's escaping, never `{@html}`, `set:html` or `innerHTML`. No external fonts, CDNs
  or analytics.
- **Images** live in a **private** R2 bucket. The API serves them at `/img/<key>`, reached through
  the Astro worker behind Access, and resizes them with the Images binding (ADR 0008). Only the API
  worker reads and writes R2. Expected to stay within the free tier.
- **Language:** the interface is in English. Slovak names and text are accepted, and search ignores
  accents ("halusky" finds "halušky").
- **Cheap to run**: stay within the Workers, D1 and R2 free tiers. Prune raw check data older than
  N days with the cron trigger.
- **Look**: void-black (`#09090b`), monospace accents, minimal (the same language as the portfolio,
  #4).

## 7. Out of scope (for now)

- Running Hermes, the Instagram uploader or the Confluence backup themselves. They stay in Hermes;
  this repo only receives their reports.
- Multi-user and a public sign-up. Sharing with guests comes much later (open item, §8).
- A self-hosted (non-Cloudflare) deployment.
- Mobile apps or push notifications (alerts go out through Hermes/Telegram).

## 8. Open questions (to settle in the brainstorm)

1. ~~**Auth:**~~ Settled 2026-11-26: Cloudflare Access for the owner, with a service token for each
   machine client (ADR 0003).
2. ~~**Toolchain:**~~ Settled 2026-11-26: npm and Wrangler only, no Bun (ADR 0002).
3. ~~**Frontend:**~~ Settled 2026-11-26: Astro server with Svelte islands (ADR 0005).
4. ~~**Hermes:**~~ Settled 2026-11-26: Nous Research's Hermes Agent, self-hosted, used through
   Telegram, connected as a custom MCP server (ADRs 0006, 0007).

### Open items for later
- **Guests and sharing** (much later): a share link, or a swipeable photo collage of the menu on
  mobile. Tracked in `WH1TE-SHAD0W/command-center#7`.
- **Kitchen tags:** can Hermes reliably pick tags from the fixed list? Needs investigation.
- **Kitchen variants:** how a genuine variant of an existing recipe is marked.
- **Streaks:** maybe later, as an optional and separate feature.
- **Level curve:** how many points each level of a stat needs.
- **Personal to-do list:** habits will tie into it; not designed.
- **Check-in format:** revisit at the end of the brainstorm, then update the whole document.
- **M13, links between modules in the database.** Either ids only (no cross-module foreign keys or
  Drizzle relations; safe because nothing is deleted), or Drizzle relations across modules too. The
  second conflicts with "if one module disappears nothing happens to the others" (ADR 0011). The
  owner leaned towards using Drizzle "to its potential". Not decided.

The full question-and-answer record is in `context/brainstorm-log.md`.

### Still open: product definition

**General**
5. **Devices:** input is settled (phone → Hermes, laptop → browser; ADR 0006). Do pages still need
   to read well on a phone (for example browsing the menu)?
6. **The home page:** What must the dashboard answer at a glance? Draft: today's habits, tonight's
   meal, anything red in the watchtower, any failed job, the latest check-in.

**Alerts** (#2 asks for "status alerts"; #1 needs to know when a job fails)
7. Which events alert you? Candidates: a service down for more than N minutes; the LAN probe silent
   (the LAN, power or internet is out); a Hermes job failed or did not run; a missed check-in.
8. Through which channel? Note that Hermes runs on the LAN, so it **cannot** report that the LAN is
   down. At least the "LAN silent" alert must come from the worker (Telegram bot API, or email via
   Cloudflare Email Service).

**Modules**
9. ~~**Habits (#5):**~~ Defined in §5.2.
10. **Check-ins (#1):** partly defined in §5.3. The format is revisited at the end.
11. ~~**Kitchen (#6):**~~ Defined in §5.1.
12. **Ideas (#3):** What do you do with an idea here: read, tag, triage, write a blueprint? Who writes
    the blueprint: you, Hermes's LLM, or an LLM call from the worker?
13. **Watchtower (#2):** Roughly how many targets, and which kinds (HTTP, TCP port, ping)? How long is
    history kept, and do you want response-time graphs?
14. **Jobs (#1):** Is status enough (last run, ok or failed, duration), or do you also want to trigger
    or re-run a job from the dashboard? Triggering would mean the worker calls into the LAN.
15. **Portfolio (#4):** Should this app expose a public, read-only status feed for the portfolio's
    "Live System Status" banner?
