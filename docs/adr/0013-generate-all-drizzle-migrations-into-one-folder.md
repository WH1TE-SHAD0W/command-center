# 0013. Generate all Drizzle migrations into one folder from one combined schema

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** Owner's decision on 2026-11-27 while planning `WH1TE-SHAD0W/command-center#11`
  ("the DB is tied together anyway and there are no deletions only archival, so … one instance of
  drizzle", then "one shared folder"). Supersedes the per-module migrations folders and the
  collector in ADR 0010. The rest of ADR 0010 (Drizzle, one schema file per module, prefixed table
  names) still holds.

## Context
ADR 0010 gave each module its own drizzle-kit config and migrations folder, plus a collector script
that copied them all into `api/d1-migrations/`, because Wrangler applies migrations from a single
folder. Before any of it was built, the owner weighed that design again. There is one D1 database,
and nothing is ever deleted (ADR 0009), so modules are never removed in a way that would need their
migrations separated. Meanwhile the collector adds a script, a second generated copy of every
migration, a CI staleness check, and one more step after every schema change.

## Decision
The API has **one Drizzle schema for the whole database**. It is still written as one file per
module in `api/src/schema/<module>.ts`, with table names prefixed by module (ADR 0010).
`api/src/schema/index.ts` re-exports every module's schema. `api/src/db.ts` creates the single
Drizzle instance, `drizzle(env.DB, { schema })`, that every service uses. Modules keep their own
logic in their services. **One** drizzle-kit config, `api/drizzle.config.ts`, reads all the schema
files and generates every migration into **one folder**, `api/migrations/`, with drizzle-kit's
default numbered names (`0000_<name>.sql`). That folder is the one Wrangler applies (its default
`migrations_dir`), so there is no collector and no `api/d1-migrations/`. Generated migrations are
still **reviewed before they are applied**, and an applied migration is never edited.

## Consequences
- Easy: one config, one command to generate, and no second copy to keep in sync. Wrangler reads
  drizzle-kit's output directly. Drizzle relations across modules are technically possible in the
  combined schema (whether to use them is still open, M13 in `context.md` §8).
- Hard: drizzle-kit keeps one shared journal and snapshot (`api/migrations/meta/`). Two branches
  that both change the schema conflict there, and whichever merges second must drop its migration
  and regenerate it on top of `main`. With issues built in parallel, schema-changing issues should
  be ordered rather than run at the same time.
- Hard: a module's migrations are mixed with everyone else's, so removing a module means writing a
  new migration by hand. Its old migrations stay.
- Do not: hand-edit `api/migrations/meta/`, edit an applied migration, or add a second drizzle-kit
  config or migrations folder without revisiting this record.

## Verification
No test result was provided. Nothing is built yet; #11 implements this.

## Alternatives considered
- **A migrations folder per module plus a collector (ADR 0010):** parallel branches touching
  different modules never conflict, and a module's migrations stay together. Rejected because it
  costs a collector script, a second generated copy and an extra step on every change, and the
  separation buys little with one shared database and no deletions.
- **One Drizzle instance per module (`drizzle(env.DB, { schema: <module> })` in each service):**
  stricter isolation, but drizzle-kit needs the combined schema anyway, and the owner wants the
  database in one place.
