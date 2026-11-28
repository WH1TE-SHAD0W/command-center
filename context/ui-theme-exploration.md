# UI and theme exploration: extract (paused 2026-11-27, decided 2026-11-28)

> **Decided on 2026-11-28:** the owner chose **Zora over the Expanse consoles**, as the first theme in
> a **swappable theme layer** (ADR 0016, `docs/specs/theme.md`). The character mechanics use Star
> Trek ideas instead of Expanse ones: **stats as ship systems the owner manages**, power pips, and a
> **five-year mission** as the goal target (`docs/specs/character.md`). The rest of this file is the
> exploration that led there, kept as it was at the pause.

> The extract from the UI brainstorm of 2026-11-27, paused at the owner's request: "lets leave it here
> for a while and make an extract of it". **Nothing here is decided** unless it is listed under
> "Settled". Decisions become real only through an ADR. The question-and-answer record is in
> `brainstorm-log.md` §9. All prototypes were drawn in the chat with synthetic data; none are in the
> repo.

## Where it stands

The finalists are **Expanse** and **Discovery / Zora-style**, and the app should have **a soul**: it
should be something, react to the owner and remember.

The owner's own words at the pause:

- "I like zora because thats how it would end up it has to know me i am the captain"
- "but expanse mindset fits more but IRL it lacks the immersion to make it work (i guess)"
- "the holographic 3d visualizations if translated to web it would make it look nice although expanse
  way is more connected on its theme"
- On the soul: "the thing is to give the app a soul or something like that something behind it it
  would work"

## Settled in the brainstorm (not yet in an ADR)

| Topic | Outcome |
|---|---|
| Dashboard vs pages | The home dashboard is a grid of panels; **every module page gets its own design** |
| Character | RPG stats on a **hexagonal radar** |
| Visual language | **Blueprint** and **data art**; **node structures** liked |
| What a theme is | Vocabulary, icons, structure and metaphor, **not only colours** |
| Palette | Expanse colours "okay" (teal lines, orange highlights, void-black) |
| Rejected | **Metro map** (habits); **Elite Dangerous** as a look (its UI needs a 3D cockpit that a web page cannot give) |
| Kept from Elite | Ideas only: **power pips** (where today's points went, liked), rank ladders per stat ending in a top rank, a mission board for goals, scanner contacts for watchtower. Owner's idea: **pips could be research points spent in the tech tree** ("just mention it even if doesnt make sense"), noted on #30 |
| Tech trees | Both kept as idea issues: #29 (roadmap from GitHub issues), #30 (character skill tree across modules, tied to craft, projects, jobs, tasks and goals) |
| Filter | A theme should work natively as a flat web page |

## The two finalists

| | Expanse | Discovery / Zora-style |
|---|---|---|
| Look | flat ship consoles: thin teal linework, orange highlights, chamfered panels, segmented meters | holographic: tick rings, arcs, pills, cyan and white with gold, translucent layers |
| The app is | **your ship**; its systems mirror your stats | **a mind that knows you**; Hermes at the centre |
| Navigation | a deck plan (stacked decks, the drive at the bottom) | modules orbiting the ship intelligence |
| Soul | **mechanical**: ship state, Δv and destinations are computed from data, work even when Hermes is silent | **a relationship**: Hermes notices, remembers and cares; depends on Hermes writing good text |
| Lexicon | ops deck, burn log, Δv, galley, nav plot, comms, engineering, condition two, Belter creole | bridge, routines, evening log, replicator programs, star chart, tasks, systems, "I'm detecting a fault…" |
| Strength | coherent world, strongest metaphor | the end state the owner wants: "it has to know me" |
| Weakness | may feel flat without immersion (owner's guess) | the 3D and glass depth is only partly translatable to the web |

### Candidate synthesis (proposed, not decided)

**An Expanse ship as the body, Hermes as its mind.** The visual language and mechanics are Expanse
(systems mirroring stats, Δv, goals as destinations, the ship's log). Hermes speaks Zora-like over it
(the orb and a line on each page). The mechanics give the app a soul from day one; Hermes adds the
relationship as it learns more. The other direction is also possible: Zora's holographic look with
Expanse's mechanics underneath.

## Ingredients of the soul

| Ingredient | Expanse version | Zora version |
|---|---|---|
| Identity | the ship is you | the ship knows you |
| Consequences | neglected stats dim their system; kept ones run hot (or upgrades only, see open questions) | Hermes notices streaks, gaps and changes |
| Purpose | goals are destinations; habits are burns earning Δv | Hermes helps towards goals with reminders |
| Memory | the ship's log: history, refits | "a year ago today you…" |
| Ritual | morning systems check, end of watch, weekly port call | the evening conversation |
| Voice | terse crew talk | warm first person |

## Page concepts drawn so far

| Page | Visualisation | Shown in |
|---|---|---|
| Home | panel grid; alternatives: ship deck plan, ship-intelligence orb with orbiting modules | hybrid, Expanse, LCARS, Discovery |
| Character | hex radar with a 30-day overlay, XP flow (habit → stat weights), service record, title block; tech tree (#30); pips | blueprint, Discovery |
| Habits | year ring: concentric day rings per stat, today's hand | blueprint, Discovery |
| Watchtower | edge and LAN schematic, with the push across the boundary and uptime strips | blueprint, Discovery |
| Kitchen | restaurant menu by type, recipe as a spec sheet (photo as a plate, ingredients as a bill of materials) | blueprint, Discovery |
| Jobs | 14-day tracks: tick height = duration, failed, missed | blueprint, Discovery |
| Ideas | constellation by tag; alternative topography | blueprint, Discovery |
| Check-ins | ribbon of nights with Hermes | Discovery |
| Roadmap | tech tree from GitHub issues (#29) | Discovery |

Map ideas still open: a territory map with fog of war (character), topography (ideas), a route map
(jobs), and geographic maps (cuisine atlas, meetups, future fitness and travel; see also #28).

## Architecture notes raised

- **Swappable themes are possible only if built in from the start:** a theme layer of tokens,
  lexicon, glyphs and shell (for example `web/src/themes/<theme>/`). Modules and the API output
  meaning (`status: fault`, `points: 40`), never words or colours. A test fails on raw colours or
  strings outside the lexicon.
- **Hermes's lines and briefing:** written by API templates, by Hermes through a new MCP tool, or
  both.
- **Suggested actions** ("remind me at 22:00") need a queue in the API that Hermes reads over MCP,
  because the worker cannot reach the LAN (context §4).
- **Maps** without external tiles: static SVG (d3-geo) or Protomaps PMTiles in R2.
- **Cross-module features** (skill tree, briefing, timeline) go through events (ADR 0011).

## Open questions at the pause

1. Expanse, Zora, or the synthesis (and which way round)?
2. Does neglect show (dimming systems), or does the ship only ever upgrade?
3. Δv as the points unit and goals as destinations: right or too gamey?
4. Hermes's personality: terse crew member, warm presence, or the owner's existing Telegram voice?
5. A swappable theme layer, or one fixed theme?
6. How deep a theme goes: labels, navigation, voice, renaming stats.
7. Who writes the Hermes lines and briefing?
8. Stats 5 and 6 for the hexagon; the level curve (rank ladders ending in a top rank were suggested).
9. Pips, rank ladders and the mission board: separate idea issues, or notes on #30?
10. Dashboard details: kitchen widget ("tonight's meal" conflicts with no meal plan), alert strip, heatmap layout, ticking on the home page, phone width, monospace vs sans.
11. Whether to save the UI inventory as `docs/ui-inventory.md`.
