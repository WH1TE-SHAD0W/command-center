# 0004. Push LAN and Hermes data into `/api/ingest/*`; never pull it

- **Status:** Proposed
- **Date:** 2026-11-26
- **Source:** `WH1TE-SHAD0W/command-center#1`, `#2`, `#3`; `context.md` §4

## Context
#2 monitors `172.16.x.x` and TrueNAS. #3 reads notes from `/opt/data/meetup_surveys/` on the Hermes
host. #1's jobs run inside Hermes. A Cloudflare Worker cannot reach private addresses, cannot read
that filesystem and cannot send ICMP.

## Decision
Data that originates on the home network is **pushed** over HTTPS to idempotent ingest endpoints
(`checks`, `job-runs`, `ideas`, `checkins`), authenticated with Access service tokens. Each item has
a client-generated `external_id`, and D1 enforces uniqueness on it. The worker's own cron checks only
public endpoints. A LAN target with no push within its staleness window shows as `stale`, not `up`.

## Consequences
- Easy: no inbound ports or tunnels into the home lab; the API stays simple and testable.
- Hard: if the probe or Hermes dies, data simply stops, so staleness detection is mandatory. A small
  probe process must be written and run (a container on TrueNAS, or a Hermes cron).
- D1 becomes the source of truth for ideas, which replaces `ideas_backlog.json`.

## Verification
No test result was provided.

## Alternatives considered
- **Cloudflare Tunnel + Workers VPC:** lets the worker call private services directly. It is more
  moving parts and exposes LAN services to the edge, so it is kept for later.
- **Hermes writes straight into D1 via the REST API:** it would bypass validation and need a
  Cloudflare API token on the LAN.
