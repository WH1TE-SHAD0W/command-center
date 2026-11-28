# Workflow: issues, branches, PRs

> Agents follow `AGENTS.md` (the operational version of this page). This page is the owner's side.

## The loop

```
Owner: decides the behaviour → spec-writer drafts a spec PR in docs/specs/ → owner merges it
   │
Owner: files or approves an issue that cites the requirement IDs ("Implements: KIT-005")
   │   "Hermes, work on command-center#N"   (Telegram)
   ▼
Hermes: reads the issue + AGENTS.md + docs → branch <type>/<N>-<slug>
        → commits (Conventional Commits, "Refs #N") → local checks
        → pushes the branch → opens a PR ("Closes #N") → watches CI
        → comments the PR link on the issue → STOPS
   │   if something is undecided: comments numbered questions on the issue and waits
   ▼
Owner: reviews the PR → squash-merges → the branch is deleted → the issue closes via "Closes #N"
   ▼
Cloudflare Workers Builds deploys main (once connected)
```

## Rules

| Topic | Rule |
|---|---|
| Branch name | `<type>/<N>-<slug>`; types: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore` |
| Commits | Conventional Commits; `Refs #N` in the body |
| PR | one issue = one PR; the title is a Conventional Commit; body sections: Problem, Approach, Tests, Risk, Exclusions, Questions; `Closes #N` |
| Who merges | **the owner only**; agents never merge |
| Merge method | squash, then delete the branch |
| `main` | changed only through PRs (the one exception was the initial docs commit, 7b9fca5) |
| CI | must be green before merging (GitHub Actions; arrives with the scaffold epic) |
| Undecided design | the agent asks on the issue with numbered options; the owner answers there |

## What makes an issue ready for an agent

- Says which module and which ADRs apply.
- Cites requirement IDs from `docs/specs/` that are `accepted` and have no **Open:** line. The
  acceptance criteria live in the spec (ADR 0015).
- Names anything explicitly **out of scope**.
- Leaves no open design choice. If one exists, decide it in the issue first, or say "propose
  options in the PR".
