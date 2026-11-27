# AGENTS.md — how an agent works in this repository

For any coding agent (Hermes Agent, Claude Code, Codex…). Follow it exactly. When something here
conflicts with your own default workflow, **this file wins**.

## 0. Read before every task

1. `context.md`: what the app is and why. §8 lists what is still **undecided**.
2. `CLAUDE.md`: the architecture rules and boundaries (they apply to every agent, not only Claude).
3. `docs/README.md`, then the ADRs in `docs/adr/` that touch your task. ADRs are binding.
4. `docs/architecture.md`: the folder layout and which files belong to a module.
5. `context/brainstorm-log.md`, only when you need to know *why* a decision was made.

## 1. The owner decides; you implement

- The owner makes **every** design decision, including small ones: names, libraries, table
  columns, enum values, file layout.
- If the issue or the docs do not settle something you need, **stop and ask**. Do not guess.
  Comment on the issue with numbered options and your recommendation, then wait. Example:
  "Q1. Column type for `servings`: a) integer, b) text such as '2–3'. I recommend a."
- Never change `context.md`, an ADR's decision, or `wrangler.jsonc` bindings or IDs, unless the
  issue explicitly asks.

## 2. One issue → one branch → one PR → the owner merges

The owner starts a task by naming an issue, for example "work on command-center#12".

```bash
# 1. Read the task: the body and all comments; the newest comments are the current state
gh issue view <N> --repo WH1TE-SHAD0W/command-center --comments

# 2. Start from an up-to-date main
git fetch origin && git checkout main && git pull --ff-only origin main

# 3. Branch: <type>/<N>-<short-slug>
#    types: feat, fix, refactor, docs, test, ci, chore
git checkout -b feat/<N>-<slug>

# 4. Work in small commits (Conventional Commits, issue in the body)
git add <only the files you changed>          # never `git add -A` / `git add .`
git commit -m "feat(kitchen): add recipe schema" -m "Refs #<N>"

# 5. Verify locally (see §4); everything must pass

# 6. Push your branch and open the PR
git push -u origin HEAD
gh pr create --repo WH1TE-SHAD0W/command-center --base main \
  --title "feat(kitchen): add recipe schema" \
  --body-file <file with the sections below>

# 7. Watch CI; fix failures caused by your change (max 3 attempts, then comment and stop)
gh pr checks --watch

# 8. Comment the PR link on the issue, then STOP
gh issue comment <N> --body "PR: <url>, CI: <green|red, why>"
```

**PR title:** a Conventional Commit, `<type>(<module>): <what>`. It becomes the squash commit on
`main`.

**PR body sections**, in this order:
```
## Problem        what the issue asks, in one or two sentences
## Approach       what you changed and why; files touched
## Tests          one line per acceptance criterion → the test that proves it; the test summary line
## Risk           what could break; migrations generated (yes/no, reviewed?)
## Exclusions     what you deliberately did not do
## Questions      open points for the owner (or "none")

Closes #<N>
```

## 3. Hard rules

- **Never merge** a PR, never push to `main`, never force-push, never rewrite pushed history. The
  owner merges (squash) and deletes the branch.
- One issue = one PR. Don't fix unrelated things; mention them under *Exclusions* instead. If an
  issue is too big for one PR, comment and suggest a split before starting.
- Never deploy (`wrangler deploy`, `npm run deploy*`), never apply **remote** D1 migrations, never
  create or delete Cloudflare resources.
- Never delete data or files that hold records. Archive instead (ADR 0009). No `DELETE` in module
  SQL outside the documented prune jobs.
- Never edit an applied migration or `api/migrations/meta/` by hand (ADR 0013).
- **The repository is public.** No secrets, tokens or real personal data (habits, check-ins,
  recipes, names) in code, fixtures, commits, issues or PRs. Use synthetic data only.
- Never weaken a test or a check to get CI green. If a check is wrong, say so in the PR.

## 4. Verify before you push

The commands exist once the scaffold issues (epic E0) have landed. Until then, the scaffold issue
you are working on defines them.

```bash
npm ci
npm run typecheck -w api && npm run typecheck -w web
npm test -w api && npm test -w web
npm run migrations:generate -w api && git status --porcelain api/migrations   # must print nothing: schema and migrations agree
npm run build -w web
```

- There must be at least one test per acceptance criterion. Quote the real summary line in the PR,
  and never claim a pass you didn't see.

## 5. Where code goes

Follow `docs/architecture.md`: the Laravel-style layout, split by type, one file per module.
Services hold the logic; controllers, MCP tools, Actions, listeners and jobs only call services. No
module imports another module's files; modules talk through events.
