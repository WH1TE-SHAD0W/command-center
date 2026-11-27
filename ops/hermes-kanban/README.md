# Hermes Kanban → GitHub issues

Hermes workers deliver GitHub issues in the background (choices A2, B1, C1).

```
issue labelled agent:ready
  └─ cc-issue-bridge.sh (Hermes cron, every 15m, no LLM)
       ├─ git worktree  $CC_ROOT/worktrees/<N>  on <type>/<N>-<slug>
       └─ cards, all sharing that worktree (dir:<path>):
            developer ─review─▶ tester ─review─▶ documenter ─review─▶ pr (done only when CI passes)
                       ▲ reviewer approves (kanban_complete) or sends back (kanban_request_changes)
```

Workers run on Gemini Flash in a Docker sandbox that sees only `$CC_ROOT`, never `/opt/data`.
Only the `pr` profile holds a GitHub token, so only `pr` can push. Nobody merges.

## Files
| File | Goes to |
|---|---|
| `setup.sh` | run once on the Hermes host |
| `docker/Dockerfile` | image `command-center-worker:latest` |
| `profiles/worker.config.yaml` | `~/.hermes/profiles/<role>/config.yaml` |
| `profiles/SOUL.md` | `~/.hermes/profiles/<role>/SOUL.md` |
| `profiles/kanban.default.yaml` | merge into `~/.hermes/config.yaml` |
| `skills/command-center-worker/` | `~/.hermes/skills-command-center/` (via `skills.external_dirs`) |
| `bridge/cc-issue-bridge.sh` | `~/.hermes/scripts/` |
| `bridge/bridge.env.example` | `~/.config/command-center/bridge.env` (chmod 600) |

## Setup
1. On the Hermes host: `GIT_EMAIL=<agent commit address> ./setup.sh`, then the steps it prints.
2. In GitHub, once: create the label `agent:ready`. Only collaborators can add labels, so this
   label is the trust gate.
3. Try it on one small chore issue: add `agent:ready`, then `hermes kanban watch`.

## Daily use
- Queue: add `agent:ready` to an issue that is `status:ready`.
- Answer a question (Telegram notification): `/kanban comment <id> "<answer>"`, then `/kanban unblock <id>`.
- Board: `hermes dashboard`, http://127.0.0.1:9119. **Never bind it to 0.0.0.0**: the Kanban API
  routes skip dashboard auth.

## Unverified until the first run
- `gemini-3.6-flash` as a model id (the docs list 3.7, 3.8 and `gemini-flash-latest`).
- `max_in_progress_per_profile` format, and the `hermes kanban list --json` shape the blocked-label
  sync relies on (that sync fails soft).
- That the reviewer spawn also loads the card's `--skill` (SOUL.md points to it either way).
- Known gap: if tests fail because of the code, the tester blocks the card for you; it does not
  loop back to the developer by itself.
