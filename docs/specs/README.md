# docs/specs/ — what each module must do

A spec is the **source of record for behaviour** (ADR 0015). `context.md` says why the app exists,
ADRs say how it is built, and a spec says what each module must do, one numbered requirement at a
time. GitHub Issues are the work items: an issue cites the requirements it implements and holds no
requirement of its own.

## One living spec per module

| Spec | Module | Prefix |
|---|---|---|
| [platform.md](platform.md) | the shared foundation: workers, auth, MCP, registry, data layer | `PLT` |
| [kitchen.md](kitchen.md) | `kitchen` (epic #6) | `KIT` |
| [factory.md](factory.md) | the software factory: how `.claude/` works, its agents, and its promises | `FAC` |

A new module gets its spec, with its own prefix, in a spec PR before any of its issues start.

## Format

```markdown
# Spec: <module>

- **Module:** `<module>` · **Prefix:** `<PFX>` · **Epic:** #N
- **Intent:** context.md §x · **ADRs:** 00xx, 00yy

## Purpose
Two or three sentences: what the module is for.

## Requirements

### PFX-001 <the requirement, as a statement>
- **Status:** accepted | implemented | retired
- **Delivered by:** #issue (PR #n), filled in when implemented
- **Acceptance:**
  1. <observable, testable behaviour>
  2. <error case>
- **Open:** <a question still to settle in a spec PR> (only while one exists)
- **History:** <YYYY-MM-DD: what changed and why> (only after a change)
```

- **IDs** are `<PREFIX>-<three digits>`, numbered in order and never reused or renumbered.
- **Statuses:** `accepted` is approved and not built yet. `implemented` is built, and tests name the
  ID. `retired` is no longer required: it stays in the file (nothing is deleted, ADR 0009) with a
  History line saying why.
- **Open** marks a question the owner has not settled. An issue that cites a requirement with an
  **Open** line does not start until a spec PR settles it.

## How specs change

1. **Spec PR first.** New or changed requirements go in a PR of their own, drafted by `spec-writer`
   from the owner's decisions. The owner's merge is the approval. A change to an existing
   requirement edits it in place and adds a History line.
2. **Then the work.** `issue-manager` files issues that say `Implements: KIT-005, KIT-006`.
3. **The implementation PR** changes only the **Status** (to `implemented`) and **Delivered by**
   lines of the requirements it delivers, and names their IDs in its tests (`it("KIT-005 AC2: …")`).
   A gap found while coding goes back to step 1; it is never decided in code.

## The traceability check

`api/test/architecture/spec-trace.test.ts` runs in CI and fails when:
- an `implemented` requirement has no test naming its ID;
- a test names an ID that no spec defines;
- a test names a requirement that is not `implemented` (flip the status in the same PR);
- an ID is duplicated, doesn't match its file's prefix, or has an unknown status.
