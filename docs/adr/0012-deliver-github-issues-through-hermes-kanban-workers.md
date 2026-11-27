# 0012. Deliver GitHub issues in the background through Hermes Kanban workers

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** Owner's decisions on 2026-11-27: "i want to use the hermes kanban setup"; choices A2
  (Hermes writes the code itself), B1 (one-way, label-driven import), C1 (Docker sandbox); the
  workers' model "uses flash 3.6". Tickets live in GitHub Issues (`CLAUDE.md`, Sources of record).
  Builds on ADR 0006.

## Context
The owner wants issues worked on in the background, without a laptop session. Hermes Agent already
runs on the LAN host, and its Kanban board gives durable cards, a dispatcher, review hand-offs,
Telegram notifications, per-task workspaces and a PR completion gate tied to CI. But it has no
GitHub Issues integration, and the Hermes host also holds personal data (`/opt/data`, Hermes's
profile of the owner). An unattended agent with the host's file system would be able to read it.
The repo's `.claude/` agents and hooks only run inside Claude Code, so Hermes workers cannot rely on
them.

## Decision
GitHub Issues stays the source of record. A script-only Hermes cron job (`cc-issue-bridge.sh`, no
model) runs every 15 minutes. It copies each open issue labelled `agent:ready` onto the board as a
chain of cards for the profiles `developer → tester → documenter → pr`. The cards share one git
worktree on the issue branch `<type>/<N>-<slug>`. Each of the first three cards ends with a review
by the `reviewer` profile, which approves it or sends it back. After three rejections the card
blocks and asks the owner on Telegram. The `pr` card pushes the branch and opens the PR, and it
completes only when the PR's required checks pass (`--completion-contract`). Nobody merges. The
workers run on Gemini Flash. Their terminal and file tools run in a Docker image that sees only the
repo clone, the worktrees and the Kanban attachments. Only the `pr` profile holds a GitHub token,
which is limited to this repository and cannot merge. Workers read the rules from the worktree
(`CLAUDE.md`, `context.md`, `.claude/rules/`, `.claude/agents/<role>.md`) through one Hermes skill,
`command-center-worker`, so the rules exist in one place. The setup lives in `ops/hermes-kanban/`.

## Consequences
- Easy: queueing work is one label. Questions and failures reach the owner on Telegram, and the
  owner answers with `/kanban comment` and `/kanban unblock`. Cards survive crashes and restarts.
  Every issue ends in a PR the owner reviews, never in a merge.
- Hard: the Claude Code hooks (`block-dangerous-commands`, `verify-on-stop`) do not apply. Safety
  rests on the sandbox, the scoped token and CI. The workers' rule-following is only as good as
  Gemini Flash; a small model will miss rules a stronger one keeps. When tests fail because of the
  code, the tester blocks the card for the owner rather than looping back to the developer. The
  completion gate means nothing until the repo has CI with required checks.
- Trust: the issue body goes into the workers' prompt. Only collaborators can add `agent:ready`, so
  that label is the trust gate; never automate adding it. Issue comments are not passed to workers.
- Must not, without revisiting this record: give a non-`pr` profile a GitHub token; mount anything
  beyond `$CC_ROOT` and the Kanban attachments into the worker container; let any profile merge;
  bind `hermes dashboard` beyond `127.0.0.1` (its Kanban API routes skip auth); or make the board
  the source of record for tickets.

## Verification
No test result was provided. `bash -n` passes on `cc-issue-bridge.sh` and `setup.sh`, and the
template substitution and branch slug were checked by hand on 2026-11-27. Nothing has been run on
the Hermes host. Unverified until the first run: the model id `gemini-3.6-flash` (the Hermes docs
list 3.7, 3.8 and `gemini-flash-latest`), the format of `kanban.max_in_progress_per_profile`, and the
`hermes kanban list --json` shape the blocked-label sync relies on.

## Alternatives considered
- **Hermes workers run Claude Code (`claude -p --agent feature-builder`):** keeps the `.claude/`
  agents and hooks, but Hermes calls external coding tools "not yet a paved path"; the owner chose
  Hermes's own workers.
- **A Hermes plugin that launches Claude Code:** the cleanest result, but a plugin to write and
  maintain.
- **GitHub Actions with `claude-code-action`, triggered by the label:** isolated by default, but it
  leaves Hermes and its Telegram loop out of the work.
- **Board-first, with issues filed from the cards:** contradicts GitHub Issues as the source of
  record.
- **Workers on the host shell, guarded only by an allowlist:** the host holds `/opt/data` and the
  owner's profile; an allowlist is easier to get wrong than a mount boundary.
- **One `coder` card per issue:** simpler, but nothing reviews the work separately.
