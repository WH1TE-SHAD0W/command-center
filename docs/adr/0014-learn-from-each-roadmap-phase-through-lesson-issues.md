# 0014. Learn from each roadmap phase through lesson issues and a steward agent

- **Status:** Accepted
- **Date:** 2026-11-28
- **Source:** Owner's decisions on 2026-11-28 ("implement a learning loop in the whole software
  factory of agents"; lessons as issues then rules, a Lessons section in every PR, a steward agent
  that opens PRs, consolidation after each roadmap phase). `WH1TE-SHAD0W/command-center#52`.
  Builds on ADR 0012.

## Context
Work is delivered by three lanes: parallel Claude Code sessions, the `/build-feature` subagent chain
and the Hermes Kanban workers (ADR 0012). They share their rules through files in the repository
(`CLAUDE.md`, `AGENTS.md`, `.claude/`, the Hermes `command-center-worker` skill), but nothing turns
what goes wrong into a better rule. On 2026-11-28 the stop hook flagged passing tests in four
sessions in a row, because `vitest` runs in watch mode, and each session only reported it. Lessons
kept in Claude Code's local memory would not reach the Hermes workers or CI. The repository is
public, so a lesson must never carry personal data. The owner makes every decision (AGENTS.md §1),
so no agent may change the rules on its own authority.

## Decision
Every PR body has a `## Lessons` section: retries, questions that had to be asked again, wrong
assumptions, hook or CI friction, or "none". When every issue of a wave in `docs/roadmap.md` is
closed, a session runs `/retro <wave>`. The `factory-steward` agent reads the Lessons sections of
the PRs merged since the previous retro, plus their CI runs and review comments, and drafts
deduplicated, sanitized lessons. `issue-manager` files each one as a GitHub issue labelled
`factory:lesson` and `status:triage`, or comments on the existing issue when a lesson recurs. The
owner approves a lesson by moving it to `status:ready`. For each approved lesson the steward makes
the smallest lasting fix on its own branch, preferring, in this order, a hook, a test, a CI check,
and only then rule text in `CLAUDE.md`, `AGENTS.md`, `.claude/` or the Hermes worker skill.
`pr-manager` opens the PR. The owner merges. The retro also checks whether lessons fixed earlier
have recurred, and records its run in the roadmap's Retros table.

## Consequences
- Easy: a problem that recurs becomes visible as one issue with a growing comment list, and its fix
  is reviewed like any other change. All three lanes learn, because the fixes land in files every
  lane reads.
- Hard: every PR body is a little longer, and every fix waits for the owner's approval and merge.
  The loop is only as good as the honesty of the Lessons sections; an agent that writes "none" by
  habit starves it. A retro runs only when a wave closes, so a lesson can wait a while.
- Must not, without revisiting this record: let the steward merge, approve its own lessons
  (`status:ready` is the owner's), edit `context.md` or an ADR's decision, change application code
  or tests to fix a lesson (that is a normal issue for `developer` or `tester`), or keep lessons only
  in local memory.

## Verification
No test result was provided. The change is agent instructions and documentation only; no code or
test changed.

## Alternatives considered
- **One append-only lessons file in the repo:** simple, but nobody triages it, it grows without
  bound, and it has no per-lesson discussion or approval.
- **Claude Code memory only:** the Hermes workers and CI never see it.
- **A retro agent after every merge:** the fastest feedback, but the most runs and the most noise
  for a single owner.
- **Agents fix a lesson in their own feature PR:** mixes factory changes into feature PRs, against
  "one issue = one PR".
- **The owner writes every rule:** the owner asked for the factory to do this work.
- **A weekly or every-five-PRs schedule:** detached from the roadmap; the owner chose the phase
  boundary.
