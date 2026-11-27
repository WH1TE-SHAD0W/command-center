# 0003. Authenticate the owner and machine clients with Cloudflare Access

- **Status:** Accepted. The Hermes part (service token) is superseded by ADR 0007: Hermes uses
  MCP with OAuth.
- **Date:** 2026-11-26
- **Source:** `context.md` §2 (one human user plus machine clients), §6; accepted by the owner on 2026-11-26

## Context
There is exactly one human user and no sign-up. Hermes and the LAN probe must also call the API.
An in-app login (Better Auth in džingel) means a users table, password handling, rate limiting and
CSRF work, all to protect one account.

## Decision
Put `app.culak.eu` behind a Cloudflare Access application. The owner signs in through Access (an
identity provider or a one-time PIN). Hermes and the probe each get their own **service token**. The
API does not trust the edge alone: middleware verifies `Cf-Access-Jwt-Assertion` against the team's
JWKS and the application's `aud`, then maps it to an actor (`owner` or `service:<name>`). Public
routes, if any, sit on a separate path with their own Access bypass policy, listed in `auth.ts`.

## Consequences
- Easy: no passwords in our code; revoking a leaked Hermes token is one click; MFA comes free.
- Hard: local dev has no Access. A dev-only bypass gated on `ENVIRONMENT=development` is needed,
  plus a test that the bypass is off by default. Being locked out of Cloudflare means being locked
  out of the app.
- `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` are worker secrets or vars.

## Verification
No test result was provided.

## Alternatives considered
- **Better Auth as in džingel:** proven in the sibling repo, but heavy for a single user.
- **Static bearer token:** simplest, but no SSO or MFA, and rotating it means redeploying every client.
