# Spec: character

- **Module:** `character` (planned) · **Prefix:** `CHR` · **Epic:** none yet (#5, #30)
- **Intent:** context.md §5.2 · **ADRs:** 0009, 0011

## Purpose
The owner is represented by a character, run like a starship they captain. Each stat is one of the
ship's systems, habits and other modules feed points into them, and a five-year mission sets the
long-term target. The character module owns stats, points, systems and the mission. It learns what
happened in other modules only through their events.

## Requirements

### CHR-001 The character has up to six stats
- **Status:** accepted
- **Acceptance:**
  1. The character has at least one and at most six stats.
  2. A stat is archived, never deleted, because past points reference it (ADR 0009).
- **Open:** the final set. The candidates are finance, physical strength, mind power and community
  (context §5.2); craft was proposed in the brainstorm.

### CHR-002 Points reach stats through events, with weights per habit
- **Status:** accepted
- **Acceptance:**
  1. A habit feeds one or several stats, each with a weight set on that habit (context §5.2).
  2. The character module receives points through events from other modules and never imports
     their files (ADR 0011); the architecture test passes.
  3. A repeated event does not award the same points twice.

### CHR-003 Points level up stats
- **Status:** accepted
- **Acceptance:**
  1. Each stat has a level derived from its points.
- **Open:** the level curve (context §8). Suggested in the brainstorm: a named rank ladder per stat
  ending in a top rank.

### CHR-004 Each stat is a starship system the owner manages
- **Status:** accepted
- **Acceptance:**
  1. Every active stat maps to exactly one ship system, and the character page shows each system
     with its level.
  2. A system's condition reflects how the stat is being developed.
- **Open:**
  - The mapping of stats to systems (for example warp core, sensors, shields, communications).
  - Does neglect show (a system dims when its stat is not developed), or does a system only ever
    upgrade?

### CHR-005 Today's points are shown as power distributed across systems
- **Status:** accepted
- **Acceptance:**
  1. The character page and its dashboard widget show today's points split across the systems as
     power pips, filled in proportion to each stat's share of today's points.
  2. A day with no points shows every system unpowered, not an error.
- **Open:** can pips also be spent as research points in a skill tree (#30)?

### CHR-006 A five-year mission is the long-term goal target
- **Status:** accepted
- **Acceptance:**
  1. A mission has a start date and ends five years later; the character page shows how far into
     the mission the owner is.
  2. The mission holds goals, and each goal shows its progress.
  3. A mission and its goals are archived, never deleted (ADR 0009).
- **Open:**
  - What a goal is made of (stat levels, habit milestones, achievements in other modules), and how
    it relates to the skill tree (#30).
  - Who sets goals: the owner in the browser, Hermes through MCP, or both.
  - Is there one mission at a time, and what happens when it ends?
