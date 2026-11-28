# 0016. Render the interface through swappable themes, with a Zora-style first theme

- **Status:** Accepted
- **Date:** 2026-11-28
- **Source:** Owner's decisions in the UI brainstorm of 2026-11-27/28 (`context/brainstorm-log.md`
  §9, U1–U22; extract in `context/ui-theme-exploration.md`): "okay i have decided to go with zora
  over expanse consoles"; "Swappable, Zora first"; "use the star trek ships idea of managing
  systems, 5 y mission as a goal target … record this using the spec driven development".
  `WH1TE-SHAD0W/command-center#92`. Requirements in `docs/specs/theme.md` (THM) and
  `docs/specs/character.md` (CHR).

## Context
The owner wants the app to have a soul, something behind it rather than a dashboard of boxes. The
brainstorm showed that a theme is more than colours: it is vocabulary, marks, structure and
metaphor. Seven directions were prototyped: Expanse ship consoles, classic LCARS, Discovery
(Zora-style), Pip-Boy, Blueprint, Glass cockpit and Elite Dangerous. Elite was rejected because its
interface depends on a 3D cockpit that a web page cannot give. The final choice was between Expanse
(the most coherent world, a flat console look) and Zora (a ship's intelligence that knows its
captain), and the owner chose Zora: "it has to know me, I am the captain". Once a theme's strings
and colours are spread through every page, changing it is a rewrite, so whether themes can be
swapped has to be decided before the first page is built.

## Decision
The web interface renders through a theme layer. A theme is a folder under `web/src/themes/<theme>/`
that supplies tokens (CSS variables), a lexicon (every user-visible string), glyphs and a shell
layout, and the Astro server renders the active theme on each request. Modules and the API return
meaning only (a status, a number, a date), never display words or colours, and a check in CI fails
on raw colours or strings outside a theme folder. The first and default theme is Star Trek Discovery
in the style of Zora: a near-black field with cyan structure and gold highlights, rings, arcs and
pills, holographic depth translated to a flat page, a starship's vocabulary, and Hermes at the
centre as the ship's intelligence. The character's game mechanics (stats as ship systems, power
pips, the five-year mission) are behaviour and live in the character spec, not in the theme, so they
stay when the theme changes.

## Consequences
- Easy: another theme (LCARS, Expanse) is a new folder with no module change; one lexicon file holds
  every word, so wording is reviewed in one place; the character's mechanics work in any theme.
- Hard: discipline from the first page, with no inline strings or colours, and every widget takes
  its words from the lexicon. The holographic look loses real depth on the web and relies on
  layering and translucency. Hermes as the centre means the home page depends on content about
  Hermes that no module produces yet (THM-005, still open).
- context.md §6 still describes the look as "void-black (`#09090b`), monospace accents, minimal".
  The owner decides whether to change it.
- Must not, without revisiting this record: put display strings or colours in API responses or
  module code, load a theme's fonts or assets from an external host, or make a page depend on a
  specific theme.

## Verification
No test result was provided by `tester`. This record and its specs come before any code (ADR 0015).

## Alternatives considered
- **Expanse ship consoles:** the most connected world and the strongest metaphor (the ship mirrors
  you, Δv, goals as destinations), but the owner judged it would lack immersion on the web and chose
  the ship's-intelligence relationship instead.
- **Classic LCARS:** native to flat screens, but the frame takes a fixed share of the width, and it
  has no intelligence at its centre.
- **Elite Dangerous:** good systems (pips, ranks, missions), and the pips are kept, but its look
  needs a 3D cockpit.
- **Pip-Boy, Blueprint, Glass cockpit:** each fits one part (RPG stats, technical drawing,
  at-a-glance status) but not the soul the owner asked for.
- **One fixed theme:** less discipline up front, but changing the look later would mean a rewrite of
  every page.
