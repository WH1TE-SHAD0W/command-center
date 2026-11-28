# Brainstorm log: questions and answers

> Every question asked during the architecture brainstorm, with the owner's answer as given (lightly
> cleaned up; quotes are the owner's own words). This is the **record of why**: `context.md` and
> `docs/adr/` hold the resulting decisions. Newest sessions are appended at the end; earlier answers
> stay even when later ones change them. Later rows note what they supersede.
>
> Sessions: 2026-11-26 and 2026-11-27.

## Working rules the owner set

| Rule | Owner's words |
|---|---|
| Ask before writing docs | "remember before writing stuff up ask" |
| The owner decides everything, even low-level details | "let me be the architect of doing low level decisions even the stupid ones" |
| Contradict when wrong | "contradict me if im wrong anywhere" |
| Docs first, code later | "once it is architected we can use the context, adrs and docs to spin up coding agents (here i want to try hermes agentic workflow)" |
| Brainstorm before acting on issues | "right now i want to brainstorm this and build the most context and definition of the app before going forward" |

## 1. Starting point

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 1.1 | Load the GitHub issues | The owner put issues #1–#6 into `WH1TE-SHAD0W/command-center` | `context.md` §5 |
| 1.2 | Architecture to follow | "use the dzingel's architecture" | ADR 0001 |
| 1.3 | API runtime | "api on the cloudflare worker using hono on bun" (Bun later dropped, see 2.2) | ADR 0001 |

## 2. Platform

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 2.1 | Login: Cloudflare Access or an in-app login? | "Yes, use Access" | ADR 0003 |
| 2.2 | Where does Bun fit? Workers don't run Bun | "lets use wrangler the native cloudflare build, bun wouldnt be used at all" | ADR 0002 |
| 2.3 | Frontend: Astro or SPA? | "astro … most probably this would lead up to be a multipage app" | ADR 0005 |
| 2.4 | "Small script, no UI framework" means what? Options: A plain TS per page, B Astro + framework islands, C Astro server rendering | "C + B with Svelte" | ADR 0005 |
| 2.5 | D1 vs Hyperdrive? | Explained: D1 is a database; Hyperdrive accelerates an external Postgres/MySQL. Recommendation D1; no objection | ADR 0001 (implicitly) |
| 2.6 | Who sees the kitchen menu? | "menu only for me, guests would come later, yes that is the intent though" | `context.md` §5.1, issue #7 |

## 3. Hermes and MCP

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 3.0 | What is Hermes? | "hermes by nous research, i self host that and have interface through telegram, i can add custom MCP servers there" | ADR 0006 |
| 3.0b | Role of Hermes | "every input or the whole thing is just managed by hermes agent if i use mobile phone so i will need to add mcp server to this"; on the laptop, the browser | ADR 0006 |
| 3.1 | Where does the MCP server run? | On the API worker (1a) | ADR 0007 |
| 3.2 | MCP auth | OAuth using Cloudflare's provider (2b) | ADR 0007 |
| 3.3 | Tool granularity | "should be lean and very much capable of expanding"; the starter kitchen tools "look good, the mcp might expand for other sections later on" (16) | ADR 0007 |
| 3.4 | Photo transfer | First "c, the api has persistent access to r2", then 19a "the upload happens on the api worker". Corrected: Hermes's MCP client hides the OAuth token, so `request_upload` returns a one-time URL on the API. "yep this keeps the intent" | ADR 0007 |
| 3.5 | Who reads recipe links? | "hermes does the job so it can ask me on the spot" | `context.md` §5.1 |
| 3.6 | Dish named without a link | Hermes asks follow-up questions (c) | `context.md` §5.1 |
| 3.7 | Same dish cooked again | "hermes should stop me creating a new entry and at maximum add a new entry or the photo attached" | `context.md` §5.1 |
| 3.17 | How does Hermes reach the API worker? | "the astro worker forwards that once authenticated". Refined: Access bypass on `/mcp`, `/token`, `/register`, `/.well-known/oauth-*` and `/uploads/*`; `/authorize` stays behind Access. "yep kind of what i meant" | ADR 0007 |
| 3.18 | How does the owner prove identity for OAuth? | "the cloudflare access is the only way to get in no passwords" | ADR 0007 |

## 4. Kitchen (#6)

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 4.1 | Scope | "kitchen is not having any plans right now only a list of me capable or ever done recipes; the result should be a browsable menu like in a restaurant; no groceries tracker" | `context.md` §5.1 |
| 4.2 | "Capable" vs "ever done" flag | Skip for now | — |
| 4.3 | Does tapping a dish open the full recipe? | Yes | `context.md` §5.1 |
| 4.4 | Fields | "name, type, servings, (auto attached tags), source link, ingredients (as JSON) … this is it for now" | `context.md` §5.1 |
| 4.5 | Photos: one or a gallery? | "i am the only cook, doesnt really matter" | — |
| 4.6 | Image serving | First a public bucket (10b), then switched to **private** R2 served through the app: "definitely"; "i believe i would easily stay on the free tier limit" | ADR 0008 |
| 4.7 | Image resizing | Cloudflare Images (11a); with the private bucket, this is the Images binding | ADR 0008 |
| 4.8 | Language | "english first, slovak accepted and diacritics understood" | `context.md` §6 |
| 4.9 | Guests and sharing | "there would be needed a sharing link or a collage for a mobile to swap through, just leave this for much later and keep it as open issue"; GitHub is the tracker ("make that up") | issue #7 |
| 4.20 | Duplicate names | "it should tell me it exists, only create if the recipe is a complete different variant (uncommon but can happen)" | `context.md` §5.1 |
| 4.21 | Cooked log | Skip at this stage | `context.md` §5.1 |
| 4.22 | `type` values | A fixed list: "whether is it a dessert or main course or side". The list starter, soup, main, side, dessert, breakfast, snack, drink, sauce: "this is crucial yes keep it" | `context.md` §5.1 |
| 4.22b | Steps or instructions | "depends on the recipe, drops everything that i put into it" (optional) | `context.md` §5.1 |
| 4.22c | Ingredients shape `[{name, amount, unit, note}]` | "cool enough" | `context.md` §5.1 |
| 4.22d | Tags | "fixed list, im not sure if hermes is capable of doing that, hopefully it is; leave for open issue further investigation" | `context.md` §8 |
| 4.23 | Accent-insensitive search | D1 full-text search, FTS5 (b) | `context.md` §5.1 |
| 4.33 | How variants are marked | "leave once again for open issue" | `context.md` §8 |

## 5. Frontend details

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 5.14 | Who serves the pages and talks to the API? | "web worker is the astro server while the api gives logic, all api connections are done within the server (like microservices)" | ADR 0005 |
| 5.15 | Astro → data | "service binding, only the api reads to d1 directly" | ADR 0005 |
| 5.25 | Browser writes: Actions, endpoints or forms? | "astro actions … keep it astro native with schema validation, no bloated routes made" | ADR 0005 |

## 6. Habits, character, check-ins (#5, #1)

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 6.0 | Input | "same workflow happens here as well: on phone i control it by hermes, on laptop by browser; at the end this is mostly an extension of all hermes doings like the cron jobs" | ADR 0006 |
| 6.0b | Visual | "there should be a github style thingie showing how often it was done" | `context.md` §5.2 |
| 6.1 | Habit kinds | "yes make that up": yes/no and counted with a target. "the coding architecture has to be able to handle type addition" | `context.md` §5.2 |
| 6.1b | Purpose | "habits are meant to do personal development so there has to be me a person (character) and i would be having some metrics like finance, physical strength, mind power, community … up to 6" | `context.md` §5.2 |
| 6.2 | Schedule | "depends on the habit" | `context.md` §5.2 |
| 6.3 | Where habits are ticked | "either i tell it to the hermes agent or directly on the web; after all this shall be tied to my personal to-do list (not thought through yet)" | `context.md` §5.2, §8 |
| 6.4 | How check-in data arrives | "each information passing from hermes is done by mcp" | `context.md` §5.3 |
| 6.5 | Check-in content | Redo it: it was meant as a fun-fact gatherer, then "went into stupid metaphors which shouldn't be used as they are high friction". The format: "leave this at the end and go back to it once we have everything sorted and update the whole thing" | `context.md` §5.3, §8 |
| 6.6 | Check-in ticks habits automatically? | Yes, automatically | `context.md` §5.3 |
| 6.7 | "Shadow Profile Update" in #1 | "it is for hermes so hermes gets to build my shadow profile for better chats" | `context.md` §5 |
| 6.8 | Day boundary, streaks, timezone | "the day resets when i go to sleep, no streak, only github style heatmap, maybe some points towards the character for level ups, timezone → dublin". Refined: the check-in closes the day ("something for hermes"), with a fallback cutoff at "3 am" | `context.md` §5.2 |
| 6.8b | Streaks vs issue #5 | "this design is not definitive, streaks might be good, maybe leave it separate at this stage and optional" | `context.md` §8 |
| 6.10 | Renaming or retiring habits | "nothing is deleted ever, only archived, as it is referenced for points" | ADR 0009 |
| 6.28 | Points per habit | "with weights, several, depends on the habit" | `context.md` §5.2 |
| 6.29 | Heatmaps | "per the development of character type" (one per stat) | `context.md` §5.2 |
| 6.31 | Is archive-only global? | "yes everything, recipes and ideas archived only" | ADR 0009 |

## 7. Expandability, ORM and the module system

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 7.0 | Expandability | "coding architecture should be very clean and expandable … dashboards of other kinds, other features of my own personal digital life … clean, adaptable and robust module-wise; for example integrating garmin clocks or ipcam, nothing for now, only to keep in mind" | `context.md` §1 |
| 7.1 | How do Hono and Astro decouple natively? | Explained, then translated into Laravel terms at the owner's request | — |
| M0 | ORM | Drizzle ("A, go with drizzle"), after comparing raw SQL, Kysely, Drizzle and Prisma | ADR 0010 |
| M1 | Module layout on disk | "it stays as one app but each section is decoupled; it is the laravel default layout" | ADR 0011 |
| M2 | Module registration | "explicitly written down" | ADR 0011 |
| M3 | Module contract | "looks good … each section is split across logic and usage in different files and fully decoupled" | ADR 0011 |
| M4 | Module-to-module communication | "it works like one app all together, background jobs live on the cloudflare queue" | ADR 0011 |
| M5 | Character and points | "own module; garmin activity another module" | ADR 0011 |
| M6 | Fixed lists | "a style, one file creating enum" | ADR 0011 |
| M6b | Kinds with behaviour | "decoupled with an interface" | ADR 0011 |
| M7 / C1 | Migrations | Per module: "i know the default layout of laravel but the db migrations could be split across, so it goes b" | ADR 0010 |
| M8 | Integrations | "a: the module is the logic on the information model, behaviour and data schema, while the connector can swap different providers" | ADR 0011 |
| M9 | Dashboards | Explained dashboard, widget and component, then: "each module creates a widget behind which the logic operates, from a shared component library; pages would come up as needed, depending on the routes" | ADR 0011 |
| M10 | Keeping modules apart | "only the architecture test; it works like one app but if one module disappears or gets replaced nothing happens to the others" | ADR 0011 |
| M11 | Astro → API | Typed HTTP over the binding (`hc`), (a) | ADR 0011 |
| M12 / C2 | Routes | "all routes stay in one router, there is not much routes at this point"; API: "controller per module with one router" | ADR 0011 |
| M13 | Links between modules in the DB | "it might contradict the decoupling mindset to go with free; the best would be a db like mongodb but i use d1 now, im not sure at this stage"; then "nothing gets deleted"; then "once it stays without deletion i can go on the data schema freely and implement drizzle to its potential". **Still open**, see `context.md` §8 | `context.md` §8 |
| C3 | Is Cloudflare Queues free? | The owner checked: available on the Workers Free plan (10,000 operations/day, 24-hour retention) | ADR 0011 |
| 7.2 | Folder layout | "i like this folder structure" | ADR 0011, `docs/architecture.md` |
| 7.3 | Details Claude added to ADRs 0010/0011: script `npm run migrations:collect -w api`; CI fails if `d1-migrations/` is stale; dependency-cruiser as the architecture test; a kind = one file plus one map entry; a failing widget shows an error card; the list of core shared files; the pre-Drizzle table sketches marked as outdated | "Keep them" (2026-11-27) | ADRs 0010, 0011 |
| 7.4 | Details Claude added to ADRs 0005–0009: 0005 validates twice (Action zod, then the API, which is authoritative); 0007 has a test pinning the Access bypass list and the KV binding `OAUTH_KV`; 0008 uses keys `<module>/<uuid>.<ext>`, a fixed list of widths and Cache API caching; 0009 adds `archived_at` with restore, hides archived items by default, fails the build on `DELETE` outside documented prune jobs, and **allows pruning machine data (e.g. raw watchtower samples)** | "Keep them too" (2026-11-27) | ADRs 0005, 0007, 0008, 0009 |

## 8. Handing over to Hermes (2026-11-27)

| # | Question | Answer | Recorded in |
|---|---|---|---|
| P0 | Pause the brainstorm? | "can we have a pause and let hermes start with development?" | — |
| P1 | What Hermes starts on | "everything we have right now" | issues (to be drafted) |
| P2 | How Hermes takes work | "hermes loads an issue as a task, loads the context from the repo and does the job" | `AGENTS.md` |
| P3 | Commit and branching | "put everything we have, all the docs, to main directly; add a branching strategy so a hermes agent knows how to do such stuff; each issue merged with a pr". Initial commit 7b9fca5 | `AGENTS.md`, `docs/workflow.md` |
| P4 | Agent personas | "hermes can define the personas in the ui" | — |
| P5 | How Hermes codes | "try to find out, never used it before". Found: its GitHub skill reads `AGENTS.md`, branches `feat/…`, Conventional Commits, `Closes #N`, watches CI, can merge but needn't | `AGENTS.md` |
| B1–B7 | Branch names, commits, PR format, merge method, where it's written | "branching strategy sounds good, but the hermes agent needs to be able to use it" | `AGENTS.md`, `docs/workflow.md` |
| B4 | Who merges | "I merge the stuff, hermes creates PRs" | `AGENTS.md` §3 |

## 9. UI, themes and visualisations (2026-11-27)

Prototypes were drawn inline in the chat; nothing was built. Data in them was synthetic.

| # | Question | Answer | Recorded in |
|---|---|---|---|
| U0 | How to approach theme and style | "lets use the newly imported skill taste of ux to create a astro page … lets think about it first what kind of styles could be used for example star trek panel" | — |
| U1 | First style direction, tokens, first page | Picked from options: **hybrid** (instrument-panel base, monospace accents, LCARS header on the home page only), **tokens created in `web/`** (no design system exists yet), **home dashboard** first. The style pick was later reopened (U5–U11) | — |
| U2 | Record it and build the Astro page now? | "not yet lets just do a prototype in the chat what would be the panels, widgets, components what is needed there how would it look like" | — |
| U3 | Other styles | Asked "what other styles could have been used?"; 15 directions listed (sci-fi, RPG, industrial, editorial, experimental) | — |
| U4 | The Expanse style | "try the expanse style"; afterwards "the expanse colors are okay" | — |
| U5 | Layouts without panels (status report, day timeline, orbit, briefing) | "this has panels as well lets make it completely distinguished and separate like okay the dashboard might be the build of panels but other sections and especially specific pages would have a nice design". So: **the dashboard is a grid of panels; each module page gets its own design** | — |
| U6 | Character page | "the character would have rpg character stats with hexagonal diagram" | — |
| U7 | Which industrial styles | "from industrial style i liked the blueprint and data art ui"; criticised the earlier rounds: "all you did before was just different colors or what so ever" | — |
| U8 | Character page prototype (hex radar, XP flows, revisions, title block) | "that visual is getting closer drop some visuals for other parts as well" | — |
| U9 | Page prototypes (habits year ring, watchtower schematic, kitchen menu + spec sheet, jobs tracks, ideas constellation) | "these widgets and components are nice i like the node structure" | — |
| U10 | What a theme is | "if it was meant to be a themed page lets say i get the star trek there would be icons and names in that not only style but theme". A theme is vocabulary, icons, structure and metaphor, not only colours. Expanse shown as a ship with stacked decks as navigation and an in-world lexicon | — |
| U11 | Star Trek versions | Classic LCARS shown, then "some futuristic ZORA like in star trek discovery styles": Hermes as the ship intelligence at the centre, modules orbiting it, a Hermes line on every page. "try showcasing each page using the widgets from before": all pages shown in that style | — |
| U12 | Can themes be swapped after the build? | Explained: yes, only if a theme layer (tokens, lexicon, glyphs, shell) exists from the start and modules output meaning, not words or colours. **Not decided** | — |
| U13 | Maps | "i love maps, what other visualizations could be implemented and where". Metro map for habits: "i dont like this" (**rejected**). Territory map, topography, route map and geographic maps (cuisine atlas, meetups, future fitness/travel) not decided | — |
| U14 | UI inventory | Full list of pages, widgets, visualisations and components given in chat; saving it as `docs/ui-inventory.md` was offered, no answer yet | — |
| U15 | Tech trees (character skill tree, app roadmap) | "i want both but the character skill tree has to overlap with the whole thing it would be most likely be tied to craft and those specs and projects, jobs, tasks done ... with goals in mind"; "keep the roadmap tech tree and character stat as ideas both in github" | issues #29, #30 |
| U16 | Find the theme | "lets find out what theme i would like to use": an interactive picker with six themes (Expanse, classic LCARS, Discovery/Zora-style, Pip-Boy, Blueprint, Glass cockpit) and five questions. No result was sent back | — |
| U17 | Elite Dangerous | "what about elite dangerous gui": prototype drawn. "the pip's section is a good idea although the as it was built feels like it requires much more immersion that the web doesnt give". Its look is **rejected**; pips **liked**; ranks, missions and scanner kept as ideas. Filter suggested: the theme should work natively as a flat web page | `ui-theme-exploration.md` |
| U18 | Finalists and the soul | "so elite's schemas doesnt fit and ui style its expanse vs zora but the thing is to give the app a soul or something like that something behind it it would work". Expanse as body (mechanical soul), Zora as mind (relationship), and both together were explained | `ui-theme-exploration.md` |
| U19 | Pause | "lets leave it here for a while and make an extract of it. I like zora because thats how it would end up it has to know me i am the captain but expanse mindest fits more but IRL it lacks the immersion to make it work (i guess). the holographic 3d visualizations if translated to web it would make it look nice although expanse way is more connected on its theme". **Undecided** between the two | `ui-theme-exploration.md` |
| U20 | Pips and the tech tree | "those pips could be research points available in the tech tree just mention it even if doesnt make sense". Recorded, not designed | issue #30 |
| U21 | Expanse or Zora | "okay i have decided to go with zora over expanse consoles" (2026-11-28). **Decided** | ADR 0016, `docs/specs/theme.md` |
| U22 | Mechanics, theme layer, records | Mechanics: "use the star trek ships idea of managing systems, 5 y mission as a goal target and other stuff in there record this using the spec driven development so these should be specs". Theme layer: "Swappable, Zora first". Records: "adr log issue and spec as per sdd" | ADR 0016, `docs/specs/theme.md`, `docs/specs/character.md`, #92 |

## Still open (as of 2026-11-27)

See `context.md` §8 for the live list. In short: M13 (cross-module links), the check-in format, kitchen
tags by Hermes, kitchen variants, the level curve, streaks, the to-do list, alerts, the remaining
modules (ideas, watchtower, jobs), and the portfolio status feed.

UI (section 9, extract in `ui-theme-exploration.md`). Decided on 2026-11-28: Zora-style theme first in a
swappable theme layer (ADR 0016); Star Trek ship systems and a five-year mission as character mechanics
(`docs/specs/character.md`). Still open: the **Open** lines in `docs/specs/theme.md` and
`docs/specs/character.md`; how deep a theme goes (renaming stats);
who writes the Hermes lines and briefing (API templates, Hermes through MCP, or both); the dashboard
questions (kitchen widget, alert strip, heatmap layout, ticking on the home page, phone width, mono vs
sans); stats 5 and 6 for the hexagon; which maps to use; what unlocking a skill-tree node does (#30);
and whether to save the UI inventory in `docs/`.
