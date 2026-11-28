# 0015. Make living module specs the source of record for behaviour

- **Status:** Accepted
- **Date:** 2026-11-28
- **Source:** Owner's decisions on 2026-11-28 ("as we are nearly there for the spec driven
  development we should make it complete, add the specs to the docs and add it to the loop"; one
  living spec per module, spec for what and issue for work, spec PR first, a CI traceability check,
  the reviewer and `/retro` check specs, a spec-writer agent). `WH1TE-SHAD0W/command-center#89`.
  Changes the "Sources of record" in `CLAUDE.md`; builds on ADR 0014.

## Context
The factory already worked from specifications: `context.md` for intent, ADRs for design, issues
with numbered acceptance criteria, one test per criterion. But the requirements lived in issue
bodies and in decision comments under them, outside the repository and outside any review of the
code. Nothing described a module as a whole once its issues closed, and nothing checked that tests
and requirements matched. PR #50 showed the cost: the owner's decision on #18 (an archived recipe
frees its name) never reached #17's schema.

## Decision
Each module has one living spec, `docs/specs/<module>.md`, with numbered requirements
(`<PREFIX>-NNN`) and the statuses `accepted`, `implemented` and `retired`; the shared foundation is
`docs/specs/platform.md`. The spec is the source of record for what the system does. An issue is a
work item that cites requirement IDs (`Implements: KIT-005`) and adds scope and notes, but no
requirement. New or changed requirements land first in a spec PR of their own, drafted by the new
`spec-writer` agent from the owner's decisions; the owner's merge is the approval. An implementation
PR changes only the status and "delivered by" lines of the requirements it delivers and names their
IDs in its tests. A gap found while coding goes back to a spec PR. A test in CI
(`spec-trace.test.ts`) fails when an implemented requirement has no test naming it, or a test names
an unknown or unimplemented requirement. The reviewer blocks a PR that does something no cited
requirement asks for, or misses one it cites. `/retro` (ADR 0014) also reports spec drift: a
requirement found missing, wrong or changed during the wave.

## Consequences
- Easy: one file answers "what does the kitchen do", decisions are reviewed and versioned with the
  code, and an untested or invented requirement fails CI.
- Hard: every change of behaviour needs a spec PR before the code, which adds a review round for
  the owner. Specs have to be kept honest: an `implemented` requirement whose code later changes must
  be changed in a spec PR first. Requirements already in open issues had to be copied into the
  specs once (this change does it for the platform and the kitchen).
- Must not, without revisiting this record: put a requirement only in an issue or a PR, change a
  requirement's text inside an implementation PR, delete or renumber a requirement (retire it), or
  weaken the traceability check.

## Verification
No test result was provided by `tester`. The traceability test was run locally in the change's own
PR; see the PR for the summary line.

## Alternatives considered
- **A folder per feature with spec, design and tasks (Spec Kit style):** strong per-feature history,
  but nothing describes a whole module, and the owner asked for one place per module.
- **A module spec plus a design note per feature:** the most complete, and the most to keep current
  for a single owner.
- **Issues stay the record, specs mirror them after merge:** keeps the drift that PR #50 showed.
- **Spec and code in the same PR:** faster, but the owner would approve a requirement and its code at
  the same time.
- **Spec written after the code:** documentation, not spec-driven development.
