# Using the app

What the owner can use today. Modules appear here as their requirements are implemented.

## Signing in

The app sits behind Cloudflare Access. Open the app's domain and sign in through Access; there is
no other login and no sign-up. Every request to the API is checked against your Access login again
(PLT-002).

## The home page

The home page shows whether the API is reachable (PLT-010):

- **API ok** (green edge): the web worker reached the API over the service binding with your login.
- **API error** (red edge) with a reason: for example, the API's Access settings are missing, or the
  API is down. The reason never includes secrets.

## Connecting Hermes

Hermes Agent talks to the app's MCP server at `/mcp` (PLT-007).

1. Add the app as a custom MCP server in Hermes, with the URL `https://<your domain>/mcp`.
2. Hermes registers itself and opens `/authorize` in your browser. Sign in through Access; the
   consent page shows the client's name and where it will redirect (PLT-008). Approve it.
3. Hermes receives a token and can list the tools of the registered modules. There are none yet;
   the kitchen tools arrive with KIT-010.

If `OAUTH_CONSENT_SECRET` is set on the API worker, an approval is remembered; otherwise the consent
page shows every time (PLT-008).
