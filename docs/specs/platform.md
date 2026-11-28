# Spec: platform

- **Module:** the shared foundation (no module of its own) · **Prefix:** `PLT` · **Epic:** none (#9–#15, #36, #40, #42)
- **Intent:** context.md §3, §4, §6 · **ADRs:** 0001, 0002, 0003, 0005, 0007, 0011, 0013

## Purpose
The two workers, the Access check, the MCP server with OAuth, the module registry and the data
layer that every module builds on. Nothing here belongs to a single module.

## Requirements

### PLT-001 The API answers a health check
- **Status:** implemented
- **Delivered by:** #9
- **Acceptance:**
  1. `GET /api/health` with a valid Access JWT returns `200` with `{ ok: true }`.
  2. Without an Access JWT it returns `401`.

### PLT-002 Every API request carries a valid Cloudflare Access JWT
- **Status:** implemented
- **Delivered by:** #14 (PR #39)
- **Acceptance:**
  1. A request without `Cf-Access-Jwt-Assertion`, or with an empty one, gets `401` with a generic
     error.
  2. A bad signature, a wrong `aud`, a wrong issuer, an expired, unsigned or malformed token gets
     `401`.
  3. A valid token passes and its claims reach the handler. The team's certs are cached in
     `OAUTH_KV`, not fetched per request; an unknown key id refetches them at most once per
     cooldown.
  4. Without `CLOUDFLARE_ACCESS_TEAM_DOMAIN` or `CLOUDFLARE_ACCESS_AUD` every checked request fails
     closed with `500`.
  5. Module routes sit behind the same check.

### PLT-003 Only the ADR 0007 machine paths skip the Access check
- **Status:** implemented
- **Delivered by:** #14 (PR #39)
- **Acceptance:**
  1. The bypass list is exactly `/mcp`, `/token`, `/register`, `/.well-known/oauth-*` and
     `/uploads/<token>`; each brings its own authentication.
  2. `/authorize` and every other path are checked, including a path that normalises out of a
     bypass prefix.

### PLT-004 Only modules listed in the registry exist
- **Status:** implemented
- **Delivered by:** #12 (PR #35)
- **Acceptance:**
  1. A module listed in `api/src/modules.ts` has its routes mounted; an unlisted one has none.
  2. With the default list the core routes still work.

### PLT-005 No module imports another module's files
- **Status:** implemented
- **Delivered by:** #12 (PR #35)
- **Acceptance:**
  1. The architecture check fails on a cross-module import.
  2. A module may import its own files and core files, and core may import modules.
  3. The real source tree passes.

### PLT-006 One shared Drizzle instance and one migrations folder
- **Status:** implemented
- **Delivered by:** #11 (PR #38)
- **Acceptance:**
  1. Services get one `drizzle(env.DB, { schema })` over the combined schema.
  2. Every migration in `api/migrations/` has drizzle-kit's numbered name, from `0000` without gaps,
     and the local D1 has all of them applied in order.

### PLT-007 The MCP server at `/mcp` is protected by OAuth
- **Status:** implemented
- **Delivered by:** #15 (PR #46)
- **Acceptance:**
  1. The OAuth provider wraps `/mcp` and serves `/token`, `/register` and the
     `/.well-known/oauth-*` metadata.
  2. `tools/list` returns the tools of listed modules only; a tool gets the bindings and the grant's
     props, and its input is validated against its schema.
  3. `/mcp` without a token, or with a made-up one, gets `401`. A token from register → authorize →
     token works, also on a fresh worker instance (OAuth state lives in KV).

### PLT-008 `/authorize` needs the owner's Access login
- **Status:** implemented
- **Delivered by:** #15 (PR #46)
- **Acceptance:**
  1. Without a valid Access JWT, `GET` and `POST /authorize` return `401`, show no consent page and
     issue no code.
  2. The consent page escapes the client name, shows the redirect host, and Deny returns
     `access_denied`. A consent handle works once, only in the browser that opened it.
  3. With `OAUTH_CONSENT_SECRET` (32+ characters) set, an approval is remembered; without it the
     page shows every time.

### PLT-009 The web worker is an Astro server app on Cloudflare
- **Status:** implemented
- **Delivered by:** #10 (PR #37)
- **Acceptance:**
  1. Astro with the Cloudflare adapter and Svelte, served on `:4321` in development.
  2. It binds `API` to `command-center-api` and binds no D1 or R2.
  3. No external fonts, CDNs or analytics; void-black `#09090b` with monospace accents.

### PLT-010 The home page shows the API's health
- **Status:** implemented
- **Delivered by:** #10 (PR #37)
- **Acceptance:**
  1. It calls `GET /api/health` through the `API` binding.
  2. It shows "API ok" on success, and an error card, without leaking the binding's error, on a
     non-2xx answer, a not-ok body or a failed call.

### PLT-011 The web worker forwards only the Access JWT to the API
- **Status:** implemented
- **Delivered by:** #40 (PR #44)
- **Acceptance:**
  1. The incoming `Cf-Access-Jwt-Assertion` is forwarded byte for byte over the binding, and no
     other client header is.
  2. The assertion is never logged, never rendered, and never sent anywhere but the binding.

### PLT-012 The web worker passes the machine paths through to the API
- **Status:** implemented
- **Delivered by:** #15 (PR #46)
- **Acceptance:**
  1. `/mcp`, `/token`, `/register`, `/.well-known/oauth-*`, `/authorize` and `/uploads/*` go over
     the binding with method, headers and body unchanged, and the API's response comes back as is.
  2. Every other path is handled by Astro.
