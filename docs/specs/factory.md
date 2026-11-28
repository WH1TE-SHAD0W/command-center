# Spec: factory

- **Module:** the agent factory (Claude Code sessions, `/build-feature`, Hermes Kanban workers) · **Prefix:** `FAC` · **Epic:** none
- **Intent:** `CLAUDE.md`, `AGENTS.md` · **ADRs:** 0012, 0014, 0015

## Purpose
How work moves from a decision to merged, documented code, and how the factory learns. Every
requirement here is met by the factory's own files (`CLAUDE.md`, `AGENTS.md`, `.claude/`, the
Hermes worker skill, `docs/`), so a conformance test can check that each rule is wired in.

## Requirements

### FAC-001 Behaviour flows from spec to issue to code to docs
- **Status:** accepted
- **Acceptance:**
  1. New or changed behaviour first lands as a spec PR in `docs/specs/`, drafted by `spec-writer`;
     the owner's merge approves it.
  2. Then `issue-manager` files an issue that cites the requirement IDs (`Implements: …`) and sets
     the scope. An issue whose cited requirement is not `accepted`, or has an **Open:** line, does
     not start.
  3. The implementation PR delivers the code, the tests naming the IDs, the status change to
     `implemented`, and the public docs update (FAC-006 to FAC-008), in that one PR.
  4. Each step is done by the agent that owns its files: `spec-writer`, `issue-manager`,
     `developer`, `tester`, `documenter`, `reviewer`, `pr-manager`.

### FAC-002 Requirements are traced to tests in CI
- **Status:** accepted
- **Acceptance:**
  1. A test fails when an `implemented` requirement has no test naming its ID, when a test names an
     ID no spec defines, or when a test names a requirement that is not `implemented`.
  2. It also fails on a duplicate ID, an ID that doesn't match its spec's prefix, or an unknown
     status.

### FAC-003 Every PR records its lessons
- **Status:** accepted
- **Acceptance:**
  1. The PR formats of all three lanes (`AGENTS.md`, the `git-pr-summary` template, the Hermes `pr`
     card) have a `## Lessons` section, with "none" allowed.
  2. `feature-builder` passes the run's lessons to `pr-manager`, and each Hermes card ends its
     summary with `Lessons:`.

### FAC-004 The factory learns after each roadmap wave
- **Status:** accepted
- **Acceptance:**
  1. When every issue of a wave is closed, `/retro <wave>` has `factory-steward` collect the Lessons
     of the PRs merged since the previous retro, with their CI runs and review comments.
  2. It also reports spec drift (requirements found missing, wrong or changed) and public-docs drift
     (FAC-006 to FAC-008).
  3. The owner sees the drafts first; `issue-manager` files them as `factory:lesson` issues; only
     the owner sets `status:ready`; each approved lesson is fixed in its own PR, preferring a hook,
     test or CI check over rule text. Nobody but the owner merges.
  4. The run is recorded in the Retros table of `docs/roadmap.md`.

### FAC-005 The reviewer blocks on spec mismatch and stale docs
- **Status:** accepted
- **Acceptance:**
  1. BLOCK when a cited requirement is missing, not set to `implemented` or untested, when the code
     does something no cited requirement asks for, or when the PR changes requirement text.
  2. BLOCK when the PR changes what the app can do, how to start or run it, or an issue's state, and
     the README, the guide or the roadmap is not updated to match.

### FAC-006 The README lists everything the app can do
- **Status:** accepted
- **Acceptance:**
  1. The root `README.md` says what command-center is, lists every `implemented` requirement of
     every spec by ID and title, grouped by module, and links to the guide, the roadmap and the
     specs.
  2. It lists no requirement that is `accepted` or `retired` as available. Planned work is only a
     link to the roadmap.
  3. A test fails when an `implemented` requirement is missing from the README, or an ID in the
     README's capability list is not `implemented`.
  4. No personal data: features are described, never the owner's entries.

### FAC-007 The guide covers quick start and every usable module
- **Status:** accepted
- **Acceptance:**
  1. `docs/guide/quick-start.md` takes a fresh clone to both workers running locally (install,
     local D1, dev servers, tests) and links to the deploy checklist in `docs/development.md`.
  2. `docs/guide/<module>.md` exists for each module that has an `implemented` requirement the owner
     uses directly (in the browser, through Hermes or over MCP), and says how to use it, citing the
     requirement IDs.
  3. `docs/guide/README.md` indexes the guide.

### FAC-008 The roadmap stays current in every PR
- **Status:** accepted
- **Acceptance:**
  1. A PR that closes, files, or re-links an issue updates `docs/roadmap.md` (states, graph classes,
     waves, issue rows) in the same PR.
  2. `/retro` checks the roadmap against GitHub's issue states and "blocked by" links, and reports
     any difference.

### FAC-009 The guide covers the infrastructure-as-code runtime once it exists
- **Status:** accepted
- **Delivered by:** waits for the issue that turns the Cloudflare setup into infrastructure as code
- **Acceptance:**
  1. When the Cloudflare resources and settings are managed as code, the quick start provisions and
     runs the app from it, and the manual dashboard steps in `docs/development.md` point to it.
