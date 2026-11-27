# Data model (draft)

> A sketch for the brainstorm. The real schema is whatever `api/src/schema/<module>.ts` (Drizzle)
> says once written (ADR 0010). The `ideas`, `watchtower`, `jobs` and `checkins` sketches below
> predate Drizzle and those modules' definitions; they will be redone.

Rules for every module:
- Nothing is deleted; owner records are archived (ADR 0009).
- Table names are prefixed with the module (`kitchen_recipes`, `habits_checks`).
- Links between modules are undecided (M13, `context.md` §8).

## habits and character (#5)
Agreed concepts (context.md §5.2):
- A character with up to 6 stats.
- Habits of an extensible **kind** (yes/no, counted with a target) on an extensible **schedule**
  (daily, specific weekdays, N times a week…).
- Each habit feeds one or more stats with **weights**.
- Ticks produce points, and points level up stats.
- A heatmap per stat.
- The day ends at the check-in, or at 03:00 Europe/Dublin.

The table layout is **not decided yet**. It waits for the module-system decisions, because kinds
and schedules must be pluggable.

## kitchen (#6)
Agreed fields (context.md §5.1):
- **name**, **type** (fixed list: starter, soup, main, side, dessert, breakfast, snack, drink,
  sauce), **servings**, **source link**
- **ingredients**: JSON `[{ name, amount, unit, note }]`
- **tags**: a fixed list
- **steps**: optional
- **photos**: R2 keys

Name uniqueness ignores case and accents; a variant rule is open. Search uses FTS5 over name, tags
and ingredients, ignoring accents. Recipes are archived, never deleted. There is no meal plan, no
grocery list and no cooked log.

The table layout is **not decided yet**.

## ideas (#3)
```sql
ideas  (id, external_id UNIQUE, captured_at, source /* meetup name */, tags TEXT /* JSON array */,
        raw TEXT, status TEXT CHECK(status IN ('new','triaged','blueprint','dropped')),
        blueprint TEXT /* markdown, nullable */)
```
This replaces `ideas_backlog.json` as the source of truth. Hermes may keep its folder as an inbox,
but once a note is pushed, D1 owns it.

## watchtower (#2)
```sql
targets (id, name, kind TEXT CHECK(kind IN ('http','tcp','ping')), address,
         origin TEXT CHECK(origin IN ('edge','lan')), enabled)
checks  (target_id, checked_at, ok INTEGER, latency_ms INTEGER)   -- pruned after 30 days
```
`origin = 'edge'` targets are checked by the worker cron; `origin = 'lan'` ones by the probe.

## jobs and check-ins (#1)
```sql
job_runs (external_id UNIQUE, job, status TEXT CHECK(status IN ('ok','failed','running')),
          started_at, finished_at, summary)
checkins (external_id UNIQUE, day TEXT UNIQUE, answers TEXT /* JSON */, created_at)
```
`checkins.answers` is the most sensitive data in the system: never logged, never sent to a third
party, never returned by any public endpoint.
