# 0007. Serve an MCP server from the API worker, secured with OAuth

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** Owner's decisions on 2026-11-26 (1a: "MCP runs on the API worker"; 2b: "OAuth using
  Cloudflare's"; 3: "lean and very much capable of expanding"); ADR 0006

## Context
Hermes needs a programmatic way to write to command-center (ADR 0006). Hermes Agent supports custom
remote MCP servers, including `auth: oauth` (OAuth 2.1 with PKCE and dynamic client registration).
The module logic already lives in the API worker.

## Decision
The API worker exposes an MCP server at `/mcp` (streamable HTTP), wrapped by Cloudflare's
`workers-oauth-provider`, which serves the OAuth endpoints and validates tokens. Tool handlers call
the same module functions as the HTTP routes. Each module registers its own tools from
`api/src/mcp/<module>.ts` (layout per ADR 0011). The set starts small (kitchen: `search_recipes`, `get_recipe`,
`create_recipe`, `update_recipe`, `attach_photo`) and grows module by module. This supersedes the
Hermes part of ADR 0003 (service token) and of ADR 0004 (ingest endpoints): Hermes goes through MCP.

**Routing (decided 2026-11-27).** The API worker keeps no public hostname. The Astro worker
forwards `/mcp`, `/token`, `/register`, `/.well-known/oauth-*`, `/authorize` and
`/uploads/<token>` unchanged over the service binding. Cloudflare Access **bypasses** all of
these except `/authorize`, where the OAuth token or the one-time token is the authentication.
`/authorize` stays behind Access: when Hermes is first connected, the owner signs in with Access,
and the API reads the Access JWT and only then issues a token. Access remains the only way to get
a token, with no passwords anywhere.

**Uploads.** Hermes's MCP client keeps the OAuth token internal, and Hermes's own tools cannot use
it. Image bytes are therefore not sent through MCP. The `request_upload` tool returns a
**one-time URL** (`/uploads/<token>`: single use, valid 10 minutes, with a size and content-type
limit). Hermes uploads the bytes there, and the API streams them into R2 and returns the key for
`attach_photo`.

## Consequences
- Easy: one place for the logic, two front doors (Astro over the binding, Hermes over MCP). Adding
  a module's tools does not touch the others. The API worker still has no public URL.
- Hard: the Access bypass list must stay exactly these paths, and a test asserts it. Hermes runs
  headless, so the first OAuth login uses `hermes mcp login` with its paste-back flow (one-time
  setup). OAuth state needs a KV namespace, which `workers-oauth-provider` requires.
- Tool inputs are validated as strictly as HTTP inputs, and free text from tools is never logged.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **A separate MCP worker (Agents SDK `McpAgent`):** stateful sessions are not needed, and it adds a
  third worker.
- **An MCP server on the LAN next to Hermes:** it would still need to call the API from outside.
- **An Access service token in headers / a static bearer token:** simpler, but the owner chose
  OAuth.
