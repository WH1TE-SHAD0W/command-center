# 0010. Use Drizzle, with a schema file and a migrations folder per module

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** Owner's decisions on 2026-11-27 (M0 "go with drizzle"; C1 "the db migrations could
  be split across, so it goes b"); `context/brainstorm-log.md` §7. Supersedes the "no ORM" part
  of ADR 0001 and the hand-written `Db` interface (ADRs 0001, 0002).

## Context
The owner wants the Eloquent experience of "the model defines the table" instead of writing every
query as an SQL string. On D1, the realistic options were raw SQL, Kysely, Drizzle and Prisma.
Drizzle is native to D1, small on Workers, and keeps migrations as plain SQL that Wrangler applies.
It also produces zod schemas from tables (`drizzle-zod`), which removes a second copy of the
validation rules.

## Decision
Each module defines its tables and relations in `api/src/schema/<module>.ts` with Drizzle, with
table names prefixed by module (`kitchen_recipes`). JSON columns are typed with `$type<>()`.
Services query through a Drizzle instance (`drizzle(env.DB, { schema })`). Relational queries
(`db.query.x.findMany({ with })`) and the query builder are preferred, and raw ``sql`…` `` is
used only where Drizzle has no model (FTS5).

Each module has its own **drizzle-kit config and migrations folder**
(`api/migrations/<module>/`), with **timestamp-prefixed** file names. A collector script
(`npm run migrations:collect -w api`) copies every module's migrations, sorted by timestamp, into
`api/d1-migrations/`. That is the `migrations_dir` Wrangler applies, and it is never edited by
hand. Generated migrations are **reviewed before they are applied**, especially table recreations,
which SQLite needs for column changes.

## Consequences
- Easy: typed rows and queries per module, validation derived from the schema, and relations with
  `with()`. A module's schema and migrations live with that module's name, so removing a module
  is clear.
- Hard: two generated artefacts per change (the module migration, then the collected copy). The
  collector must be deterministic, and CI checks that `d1-migrations/` is up to date. SQLite column
  changes produce recreate-and-copy migrations that need care with foreign keys on D1. FTS5 tables
  and their triggers are hand-written custom migrations.
- Archive-only (ADR 0009) becomes one shared Drizzle helper instead of `archived_at IS NULL` in
  every query.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **Raw SQL behind `Db` (ADR 0001 as written):** no dependency, but untyped strings and validation
  rules written twice.
- **Kysely:** typed, but no schema in code, no migrations, no zod.
- **Prisma:** the closest feel to Eloquent, but its own language, an extra generation step and the
  largest bundle.
- **One shared migrations folder (M7a):** drizzle-kit's natural mode, but the owner prefers
  migrations split per module.
