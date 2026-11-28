# command-center — repository instructions

A single-user personal command centre (`app.culak.eu`): Astro server + Svelte (`web/`) → Hono + MCP
(`api/`) → D1/R2, on
two Cloudflare Workers, built and run with npm + Wrangler only (no Bun). The architecture follows
džingel's.

@context.md

## Sources of record
- **Intent:** `context.md` (above). Why each decision was made: `context/brainstorm-log.md`.
  Decisions: `docs/adr/`. How it works today: `docs/`.
- **Behaviour:** the living module specs in `docs/specs/` (ADR 0015). A requirement exists only
  there, as a numbered ID such as `KIT-005`. New or changed behaviour goes into a spec PR first.
- **Tickets:** GitHub Issues in the repository behind `origin` (`git remote get-url origin`).
  Resolve `owner/repo` from `origin` for every `gh` call. Take the issue number from the request; if
  it cannot be fetched, stop and say so. Never substitute a similar issue. An issue is a work item:
  it cites the requirement IDs it implements and sets the scope.
- When the spec, the ticket, `context.md` and the code disagree, the spec decides the behaviour and
  the ticket decides the scope. Report the disagreement; never settle it in code.

## Boundaries
- Application code: `api/src/`, `api/migrations/`, `web/src/`, `web/worker/` (owned by `developer`).
  Tests: `**/*.test.ts`, `api/test/`, `web/test/` (owned by `tester`). Docs: `docs/` and the root
  `README.md` (owned by `documenter`), except `docs/specs/` (owned by `spec-writer`; an implementation PR changes only the
  Status and Delivered by lines of what it delivers). Factory files: `CLAUDE.md`, `AGENTS.md`,
  `.claude/`, `.github/workflows/`, `.github/ISSUE_TEMPLATE/`, `ops/hermes-kanban/` (owned by
  `factory-steward`, through approved `factory:lesson` issues, ADR 0014).
- `context.md` is human-owned intent. Edit it only when the human asks.
- Never change `wrangler.jsonc` bindings or IDs, deploy, or apply remote D1 migrations unless the
  human explicitly asks.
- Keep the architecture (ADRs 0010, 0011, 0013):
  - **Data:** Drizzle with one schema file per module, combined into one shared instance
    (`api/src/db.ts`). Never edit an applied migration; generate a new one into `api/migrations/`
    with `npm run migrations:generate -w api` and review it. Never hand-edit `api/migrations/meta/`.
  - **Layout:** Laravel-style, split by type, one file per module. Services hold the logic and are
    the only place that queries; controllers, MCP tools, Actions, listeners and jobs only call them.
  - **Boundaries:** no module imports another module's files. Use events, and the architecture test
    must pass. New modules are added to `api/src/modules.ts` explicitly.
  - **Types:** fixed lists are one enum file each in `enums/`; kinds with behaviour implement an
    interface in `kinds/<module>/`.
  - **Nothing is ever deleted**: archive instead (ADR 0009).
- The worker cannot reach the LAN. Anything local is pushed into `/api/ingest/*`; never design a
  route that expects to call `172.16.x.x` or read `/opt/data`.

## Planning, testing, commits
- Before editing, give a short plan: which files change, which tests are added, and which
  acceptance criterion each change serves.
- Every business-logic change gets at least one test per acceptance criterion: Vitest with
  `@cloudflare/vitest-pool-workers` (inside workerd, local D1, migrations applied). Synthetic
  fixtures only, never real habits, meals or check-ins.
- Never claim tests pass without running them. Quote the summary line.
- Follow `AGENTS.md` for the issue → branch → PR flow (`docs/workflow.md` is the owner's side).
  Work on a branch `<type>/<N>-<slug>`, never on `main`. Use Conventional Commits with `Refs #N`.
  Stage only your own files. Push your own issue branch and open its PR; **never merge**, never push
  to `main`, never force-push. The owner merges.

## Privacy & security
- Personal data (reflections, habits, meals, travel) never goes in logs, errors, fixtures, issues
  or commits. The repo is public.
- Every route is behind Cloudflare Access, and the API also validates the Access JWT. Public routes
  need an explicit allowlist entry and an ADR.
- Validate all input server-side (HTTP routes **and** MCP tools) and use parameterised SQL. Render
  user content only through Svelte's or Astro's escaping, never `{@html}`, `set:html` or
  `innerHTML`. No external fonts, CDNs or analytics.
- The browser talks only to the Astro worker; the Astro worker reaches the API only over the
  service binding; only the API binds D1 and R2.

## Commands (once scaffolded)
```
npm install
npm run migrate:local -w api   # local D1
npm run dev:api                # wrangler dev, api worker on :8787
npm run dev:web                # astro dev on :4321, proxies /api
npm run typecheck -w api
npm test -w api                # vitest in workerd
```
