---
name: retro
description: "Run the factory learning loop (ADR 0014) after a wave of docs/roadmap.md closes: factory-steward collects the Lessons sections of the merged PRs, issue-manager files factory:lesson issues, the owner approves, then factory-steward fixes each approved lesson and pr-manager opens its PR. Use when the user asks for a retro, or when the last issue of a roadmap wave has merged."
argument-hint: "<wave number>"
disable-model-invocation: true
---

# /retro: learn from one roadmap wave

Wave: `$ARGUMENTS`

You supervise; the subagents do the work. Pass each one what it needs explicitly, because they do
not see this conversation.

1. **Check the wave.** In `docs/roadmap.md`, every issue of the wave is closed
   (`gh issue view N --json state`). If not, list the open ones and stop. Read the Retros table for
   the previous retro's date.
2. **Collect.** Delegate to `factory-steward`, mode 1, with the wave and that date. It also
   re-checks the wave's delivered requirements against the specs, and the public docs against the
   specs and GitHub (FAC-005, FAC-006).
3. **Show the drafts to the owner** as a numbered list (new, recurrence or duplicate). The owner
   may edit, merge or drop any of them. Nothing is filed without the owner's go-ahead.
4. **File.** Delegate to `issue-manager`: create each new lesson as an issue with the labels
   `factory:lesson` and `status:triage`, using the steward's sections as the body; for a recurrence,
   comment on the existing issue (and reopen it if it was closed).
5. **Approve.** The owner moves the lessons to fix now to `status:ready`. Never set it yourself.
6. **Fix.** For each `status:ready` lesson, one at a time: `factory-steward` mode 2, then
   `reviewer` on the branch, then `pr-manager` to open the PR with `Closes #<lesson>`. A lesson that
   needs application code or tests becomes a normal issue through `issue-manager` instead. A
   spec-drift lesson is fixed by `spec-writer` in a spec PR (ADR 0015); a docs-drift lesson by
   `documenter` in a docs PR (FAC-005).
7. **Record.** Add a row to the Retros table in `docs/roadmap.md` (wave, date, lesson issues), in the
   first fix PR or a docs PR of its own.
8. **Report:** PRs read, lessons filed or updated, lessons approved, PRs opened. Nobody merges.
