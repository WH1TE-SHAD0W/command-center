# Quick start

From a fresh clone to both workers running locally. You need Node.js 24 and npm; Wrangler comes
with the dependencies. Nothing here touches your Cloudflare account.

## 1. Install

```
git clone https://github.com/WH1TE-SHAD0W/command-center.git
cd command-center
npm ci
```

## 2. Create the local database

```
npm run migrate:local -w api
```

This applies every migration in `api/migrations/` to a local D1 (PLT-006). Tests do this on their
own.

## 3. Run both workers

In two terminals:

```
npm run dev -w api     # the API worker on http://localhost:8787
npm run dev:web        # the web worker on http://localhost:4321
```

Open http://localhost:4321. The home page calls the API's health check over the service binding
(PLT-010). Locally there is no Cloudflare Access in front, so the API answers `401` and the page
shows the red **API error** card (PLT-002). A local development bypass is planned in #41.

## 4. Check your work

```
npm run typecheck -w api
npm run typecheck -w web
npm test -w api
npm test -w web
npm run build -w web
```

The API tests run inside workerd against a local D1. The architecture tests also check module
boundaries (PLT-005), that every implemented requirement is tested (FAC-002), and that this repo's
public docs list everything that is built (FAC-005).

## Deploying

Both workers deploy through Cloudflare Workers Builds on every push to `main`. The one-time setup
(resources, Access, build settings, variables) is the owner checklist in
[docs/development.md](../development.md#owner-checklist-first-deploy). Once the Cloudflare setup is
infrastructure as code, this page will run from it instead (FAC-009).
