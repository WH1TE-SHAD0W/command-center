---
paths:
  - "**/*.test.ts"
  - "api/test/**"
  - "web/test/**"
---

# Test guardrails

1. Test through the public surface: `createApp(nodeDb(":memory:"))` + `app.request(...)`.
2. Name the requirement ID from `docs/specs/` in each test (`it("KIT-005 AC2: refuses a duplicate")`),
   at least one `it` per acceptance item of each requirement delivered (ADR 0015). The spec
   traceability test checks the IDs.
3. **Synthetic data only** — `alex.dev@example.org`, "Test Crew", "synthetic quote 1". Never real
   quotes, names or chat excerpts.
4. Each test builds its own fresh in-memory DB; no shared mutable state, no files on disk, no network.
5. Cover the boundary values from `.claude/rules/api.md` (exactly-at and one-over limits) and the
   error statuses, not just the happy path.
