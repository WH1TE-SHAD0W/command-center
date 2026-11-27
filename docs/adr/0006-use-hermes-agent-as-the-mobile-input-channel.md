# 0006. Use Hermes Agent as the input channel on the phone; the browser on the laptop

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** Owner's decisions on 2026-11-26: "every input or the whole thing is just managed by
  hermes agent if I use mobile phone"; Hermes is "Nous Research's, self-hosted, interface through
  Telegram, I can add custom MCP servers"

## Context
The owner already runs Nous Research's Hermes Agent, self-hosted and reached through Telegram, for
cron jobs and check-ins. Typing structured data into web forms on a phone is high-friction. Sending
Hermes a photo and a sentence is not.

## Decision
On the phone, every input goes through **Hermes**. Hermes understands the message (a photo, a dish
name, a link), asks the owner follow-up questions in Telegram when something is missing, then
writes to command-center through its **MCP server** (ADR 0007). On the laptop, the owner uses the
web UI in the browser. Both paths end in the same API module functions, so the rules (validation,
duplicate checks, archiving) are enforced once, in the API.

## Consequences
- Easy: low-friction capture from anywhere. The web UI does not have to be a great data-entry tool
  on mobile.
- Hard: each module needs MCP tools as well as pages. The tools must return clear, specific errors
  (for example "this recipe already exists, id …") so Hermes can explain them to the owner. Hermes
  becomes a dependency for mobile input; if it is down, the owner falls back to the browser.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **A mobile-first web UI for all input:** works without Hermes, but forms on a phone are what the
  owner wants to avoid.
- **A Telegram bot built into the worker:** duplicates what Hermes already does, and does it worse.
