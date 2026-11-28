# Spec: factory

- **Module:** the software factory: everything in `.claude/`, plus `AGENTS.md` and the Hermes worker skill · **Prefix:** `FAC` · **Epic:** none
- **Intent:** `CLAUDE.md`, `AGENTS.md` · **ADRs:** 0012, 0014, 0015

## Purpose
command-center is built by a software factory of AI agents working under one human owner. This
file describes the whole factory: how a change travels from an idea to documented, merged code,
which agent does each step, and the hooks and rules that keep them in line. The requirements at the
end are the factory's promises, at the level you would show a customer.

## How a change travels

```
 Owner decides ─▶ 1 Spec ─▶ 2 Issue ─▶ 3 Code ─▶ 4 Tests ─▶ 5 Review ─▶ 6 Docs ─▶ 7 PR ─▶ Owner merges
                  spec-     issue-     developer  tester    reviewer   documenter pr-manager
                  writer    manager                         (vs spec)             pr-reviewer
                                                                                       │
                     8 Retro after each roadmap wave: factory-steward ◀───────────────┘
                       (lessons, spec drift, docs drift, delivered work re-checked against specs)
```

1. **Spec.** The owner's decision becomes numbered requirements in `docs/specs/<module>.md`, in a
   spec PR. The owner's merge approves it.
2. **Issue.** A work item that cites the requirement IDs it implements and sets the scope.
3. **Code.** Built against the cited requirements only. A gap goes back to step 1.
4. **Tests.** At least one test per acceptance item, named with the requirement ID.
5. **Review against the spec.** Every cited requirement delivered and tested, nothing built that no
   requirement asks for, security and privacy rules kept.
6. **Docs.** The README, the guide and the roadmap are updated in the same PR.
7. **PR.** Opened with a Lessons section, verified on GitHub. Nobody but the owner merges.
8. **Retro.** When a roadmap wave closes, the factory re-checks the delivered work against the
   specs, collects the lessons, and fixes itself with the owner's approval.

## Three lanes, one rulebook

| Lane | When | How it reads the rules |
|---|---|---|
| Claude Code sessions | the owner works on the laptop, one session per issue | `CLAUDE.md`, `AGENTS.md`, `.claude/` |
| `/build-feature` | one issue end to end, each step delegated to a subagent | the agents below |
| Hermes Kanban workers (ADR 0012, paused) | issues labelled `agent:ready`, in the background | the `command-center-worker` skill reads the same files |

## Agents (`.claude/agents/`)

| Agent | Step | Writes | Limits |
|---|---|---|---|
| `spec-writer` | 1 | `docs/specs/` | asks the owner instead of inventing; never marks a requirement implemented |
| `issue-manager` | 2 | GitHub Issues (the only agent that does) | files nothing without the owner's go-ahead |
| `developer` | 3 | `api/src/`, `api/migrations/`, `web/src/`, `web/worker/`; the status line of delivered requirements | GitHub read-only; never pushes |
| `tester` | 4 | tests | never fixes code; synthetic data only |
| `reviewer` | 5 | nothing | read-only shell; blocks on spec mismatch, stale docs or a broken rule |
| `documenter` | 6 | `docs/` except `docs/specs/` | read-only shell apart from committing docs |
| `pr-manager` | 7 | the PR (push + create) | runs only after the reviewer approves; never merges |
| `pr-reviewer` | 7 | one verification comment on the PR | read-only otherwise |
| `feature-builder` | 2–7 | nothing | supervisor: delegates every step, cannot edit |
| `factory-steward` | 8 | the factory files (`CLAUDE.md`, `AGENTS.md`, `.claude/`, workflows, `ops/hermes-kanban/`) | fixes only lessons the owner approved; never pushes or merges |

## Skills (`.claude/skills/`)

| Skill | What it does |
|---|---|
| `/ticket` | drafts an issue from a one-line idea and files it after confirmation |
| `/build-feature` | runs steps 2–7 for one issue through the agents |
| `/retro` | runs step 8 for one roadmap wave |
| `/git-commit`, `/git-pr-summary` | write the commit message and the PR body |
| `adr` | writes an Architecture Decision Record |
| `github-issues` | issue, label and status conventions |
| `pii-sanitizer` | privacy rules and the redaction helper |

## Hooks (`.claude/hooks/`) and rules (`.claude/rules/`)

| Guard | What it enforces |
|---|---|
| `block-dangerous-commands` | blocks destructive shell commands for every agent |
| `bash-guard` | per-agent shell modes: GitHub read-only, fully read-only, docs-only commits, branch push only, PR comments only |
| `tmp-write-guard` | lets `pr-manager` and `pr-reviewer` write only temp files |
| `verify-on-stop` | runs typecheck and tests when a session or agent stops |
| `rules/api.md`, `web.md`, `migrations.md`, `tests.md` | path-scoped instructions loaded when those files are touched |

## Requirements

### FAC-001 Every change is specified before it is built
- **Status:** accepted
- **Acceptance:**
  1. New or changed behaviour exists first as numbered requirements in a module spec, approved by
     the owner.
  2. Work starts only from an issue that cites approved requirements with no open questions.

### FAC-002 Every requirement is proven by a test
- **Status:** accepted
- **Acceptance:**
  1. Each delivered requirement has at least one test that names it.
  2. CI fails when a delivered requirement has no test, or a test names a requirement that doesn't
     exist or isn't delivered.

### FAC-003 Every change is reviewed against its spec before the owner sees it
- **Status:** accepted
- **Acceptance:**
  1. A separate review agent checks each change against the requirements it cites, the security and
     privacy rules, and the docs, and blocks it when anything is missing or extra.
  2. The PR states which requirement each test proves.

### FAC-004 The owner decides and merges; agents implement
- **Status:** accepted
- **Acceptance:**
  1. Every design decision is the owner's; an agent asks with numbered options instead of guessing.
  2. No agent merges, deploys, or changes infrastructure settings on its own.

### FAC-005 The public docs always describe the app as it is today
- **Status:** accepted
- **Acceptance:**
  1. The README lists everything the app can do today, by module and requirement, and links to the
     guide, the roadmap and the specs.
  2. The guide has a quick start from a fresh clone to a running app, and a page for each module the
     owner can use.
  3. The roadmap shows every issue's state and what can start next.
  4. Each change updates them in the same PR; CI catches a delivered requirement missing from the
     README.

### FAC-006 The factory learns after every phase
- **Status:** accepted
- **Acceptance:**
  1. Every PR records its lessons.
  2. When a roadmap wave closes, the delivered work is re-checked against the specs, and the
     lessons, spec drift and docs drift become tracked issues.
  3. The owner approves each fix, and the factory changes itself through a normal reviewed PR,
     preferring an automatic check over more instructions.

### FAC-007 Personal data never enters the repository
- **Status:** accepted
- **Acceptance:**
  1. Specs, tests, fixtures, issues, PRs, lessons and logs use synthetic data only.

### FAC-008 The whole factory is described in one place
- **Status:** accepted
- **Acceptance:**
  1. Every agent, skill, hook and rule in `.claude/` is described in this file, and a test fails when
     one is missing.

### FAC-009 Running the app from infrastructure as code is documented once it exists
- **Status:** accepted
- **Delivered by:** waits for the issue that turns the Cloudflare setup into infrastructure as code
- **Acceptance:**
  1. When the Cloudflare resources and settings are managed as code, the quick start provisions and
     runs the app from it.
