# 0011. Organise the code as decoupled modules in a Laravel-style layout

- **Status:** Accepted (cross-module links, M13, still open)
- **Date:** 2026-11-27
- **Source:** Owner's decisions M1–M12 and C2–C3 on 2026-11-27 (`context/brainstorm-log.md` §7);
  `context.md` §1 ("clean, adaptable and robust module-wise")

## Context
command-center will keep growing: new modules, other kinds of dashboards, and integrations (a
Garmin watch or an IP camera, kept in mind). The owner wants it to work "like one app", but with each
section decoupled: "if one module disappears or gets replaced nothing happens to the others". Hono
and Astro supply routing, validation, per-request context, typed clients and isolated widgets. They
do not supply a module list, events, a scheduler or pluggable types.

## Decision
**Layout: split by type, like Laravel's default layout.** One file per module in each folder:

```
api/src/
  app.ts                 createApp: middleware + router + /mcp
  routes.ts              the ONE router (≈ routes/api.php): every endpoint → a controller
  modules.ts             explicit module list (≈ bootstrap/providers.php)
  controllers/<m>.ts     HTTP usage only (handlers via createFactory().createHandlers())
  services/<m>.ts        the logic; the only place that queries
  schema/<m>.ts          Drizzle tables + relations (ADR 0010)
  validation/<m>.ts      zod, from drizzle-zod
  mcp/<m>.ts             MCP tools: usage only, they call services
  events/                typed event definitions
  listeners/<m>.ts       a module's reactions to other modules' events
  jobs/                  Cloudflare Queues consumers
  schedule.ts            cron entries (≈ routes/console.php)
  enums/<name>.ts        one fixed list per file (e.g. recipe-type.ts)
  kinds/<m>/<kind>.ts    one implementation per kind of an interface (e.g. habit kinds, schedules)
  connectors/<domain>/<provider>.ts   swappable providers (e.g. fitness/garmin.ts)
web/src/
  pages/                 the one web router; module pages under pages/<m>/; index.astro = dashboard
  actions/index.ts       merges actions/<m>.ts
  components/ui/         the shared component library ("one style")
  components/dashboard/  one widget per module
  components/<m>/        module-specific components
```

**Rules:**
1. **Logic is separate from usage.** Services hold all logic and queries. Controllers, MCP tools,
   Astro Actions, listeners and jobs only validate, call a service and shape the response.
2. **Modules are listed explicitly** in `modules.ts`. A module's routes, tools, listeners, jobs,
   schedule entries and widget exist only if it is listed there.
3. **No module imports another module's files.** They talk through **typed events**, handled
   synchronously in the same request ("works like one app"). Background work goes on **Cloudflare
   Queues** (available on the free plan: 10,000 operations a day, 24-hour retention). An
   **architecture test** (dependency-cruiser) fails the build on a cross-module import. Shared
   code lives only in core files (`app.ts`, `routes.ts`, `events/`, `enums/`, `components/ui/`).
4. **Kinds with behaviour** are implementations of an interface in `kinds/<m>/`, registered in a
   map and stored as `kind` plus a typed JSON `config`. Adding a kind is one new file plus one map
   entry.
5. **Fixed lists** are TypeScript enums, one file each in `enums/`. Adding a value is a code
   change, with no migration.
6. **Modules vs connectors.** A module owns the information model, behaviour and data schema
   (e.g. `fitness`). A connector is a swappable provider behind an interface (e.g. `garmin`) that
   brings data in and emits events. Credentials are secrets; syncs run on the schedule or a webhook.
7. **Points and the character** are their own module, `character`, which listens to events such
   as `habit.ticked` (later `fitness.activity-recorded`). Habits know nothing about levels.
8. **Dashboard:** each module provides one **widget**: a summary from the API plus a component
   built only from the shared component library. Widgets load independently (Astro server islands),
   and a failing widget shows an error card. The home page is the dashboard; other pages or
   dashboards are added as routes when needed.
9. **Astro → API** uses Hono's typed `hc` client over the service binding (one client per module
   if editor performance requires it).

## Consequences
- Easy: familiar Laravel-style navigation. A new module means one file in each relevant folder plus
  one line in `modules.ts`. Removing a module means deleting its files and its line, and the
  architecture test proves nothing else breaks.
- Hard: a module's code is spread over several folders, so the per-module file list must be kept
  in `docs/architecture.md`. Events add one level of indirection. The single router file and the
  Actions index grow with every module. Drizzle relations across modules are blocked by rule 3
  unless M13 decides otherwise.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **A folder per module (`nwidart/laravel-modules` style):** easier to remove a module as a unit;
  not chosen, as the owner prefers the default layout.
- **A worker per module:** true isolation, but heavy for one user.
- **Direct service calls between modules:** simpler, but it couples modules.
- **Auto-discovered modules:** less to write, but invisible; the owner wants the list written down.
