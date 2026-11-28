# Spec: theme

- **Module:** the web interface's theme layer (no API module of its own) · **Prefix:** `THM` · **Epic:** none (#92)
- **Intent:** context.md §3 (dashboard), §6 (look) · **ADRs:** 0005, 0011, 0016

## Purpose
How the web interface looks and speaks. Every page renders through a swappable theme: its colours,
words, marks and frame come from the active theme, and modules only supply meaning. The first theme
is Star Trek Discovery in the style of Zora, the ship's intelligence: the app is the owner's ship,
the owner is the captain, and Hermes is the mind that knows them.

## Requirements

### THM-001 The interface renders through a swappable theme layer
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. A theme lives in its own folder under `web/src/themes/<theme>/` and supplies tokens (CSS
     variables), a lexicon (every UI string), glyphs (status and module marks) and a shell (the
     layout around every page).
  2. Every page and widget takes its colours, strings, marks and frame from the active theme.
  3. Theme fonts are self-hosted; a theme loads nothing from an external host (CLAUDE.md).

### THM-002 Modules and the API return meaning, never display words or colours
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. API responses and widget props carry values such as `status: "fault"` or `points: 40`, never a
     display label or a colour.
  2. A check in CI fails when a raw colour or a user-visible string appears in a page or component
     outside a theme folder.

### THM-003 Adding or removing a theme touches no module
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. A second theme can be added as a new folder plus one registry entry, with no change under
     `api/src/` or in any page's data.
  2. Removing a theme that is not active leaves every page rendering.

### THM-004 The Zora-style theme is the first and default theme
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. It is the default theme.
  2. Its look: a near-black field, cyan for structure and nominal states, gold for "you are here"
     and highlights, red only for faults; circles, arcs, tick rings and pills instead of boxes; thin
     lines.
  3. The ship's intelligence is Hermes, the owner's agent (ADR 0006).
- **Open:** does Hermes keep its own name in the theme (recommended, and it keeps a show
  character's name out of the public repo), or take a ship-intelligence name?

### THM-005 Hermes is at the centre of the home page
- **Status:** accepted
- **Acceptance:**
  1. The home page centres on Hermes as the ship's intelligence, with the modules arranged around it.
  2. The home page still shows every module's widget, and anything in a fault state is visible
     without scrolling.
- **Open:** do pages carry a line from Hermes, and who writes it: API templates from module data,
  Hermes through a new MCP tool, or both? Suggested actions ("remind me at 22:00") would need a
  queue in the API that Hermes reads over MCP, because the worker cannot reach the LAN (context §4).

### THM-006 Holographic visuals are translated to a flat web page
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. Depth is shown with layering, translucency and thin geometry, not 3D scenes or head-tracked
     perspective.
  2. Motion (turning rings, Hermes's waveform) stops when the browser asks for reduced motion.
  3. Pages stay readable at phone width.

### THM-007 The home page is a grid of panels; each module page has its own design
- **Status:** accepted
- **Acceptance:**
  1. The home page is built from one widget per module (ADR 0011).
  2. Each module page has a design of its own on top of the theme (for example the character's
     hexagon radar, the habits year ring, the watchtower schematic), not the dashboard panels.

### THM-008 The theme speaks a starship's language
- **Status:** accepted
- **Delivered by:** #92
- **Acceptance:**
  1. Module names, states and alerts come from the theme's lexicon in starship terms, for example
     the bridge (home), alerts as yellow and red alert, and dates as a stardate next to the real
     date.
  2. A plain date and time stay available wherever a stardate is shown.
- **Open:** the exact terms. Candidates from the brainstorm: bridge, personnel file, routines,
  evening log, replicator programs, star chart, tasks, systems.

### THM-009 The active theme is chosen at runtime
- **Status:** accepted
- **Acceptance:**
  1. The Astro server renders the active theme on each request, so the page arrives themed with no
     flash.
- **Open:** where the choice is stored: a setting in the app (in D1, switchable from the browser
  and perhaps by Hermes) or fixed per deploy.
