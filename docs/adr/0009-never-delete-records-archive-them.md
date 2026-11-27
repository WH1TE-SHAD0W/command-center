# 0009. Never delete records; archive them

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** Owner's decisions on 2026-11-27: "nothing is deleted ever, only archived, as it is
  referenced for points"; "yes, everything: recipes and ideas archived only"

## Context
Habits are referenced by the points history of the character's stats, so deleting a habit would
corrupt past levels. The owner wants the same guarantee for everything (recipes, ideas and the rest):
the system is a long-term record of their life.

## Decision
No module deletes rows or R2 objects. Every table holding owner records has an `archived_at`
column (NULL means active). "Remove" in the UI and in MCP tools sets `archived_at`, and "restore"
clears it. Lists hide archived records by default and can show them on request. There are no
`DELETE FROM` statements in application code and no MCP tool that deletes. Machine data that is
not an owner record (for example raw watchtower check samples) may be pruned. Each module documents
which of its tables count as owner records.

## Consequences
- Easy: history (points, heatmaps, recipe photos) can always be rebuilt. Mistakes are reversible.
- Hard: every query on owner records must filter on `archived_at`. Uniqueness rules (such as "one
  recipe per name") must decide whether archived rows count. Storage only grows.
- A test or lint check fails the build if `DELETE` appears in module SQL outside the documented
  prune jobs.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **Hard delete with a confirmation:** simplest, but it breaks points history and is irreversible.
- **An audit or history table per change:** more than is needed now; archiving covers the stated need.
