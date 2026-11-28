import {
  AuthorizationError,
  CimdFetchError,
  type AuthRequest,
  type ConsentDescription,
  type OAuthHelpers,
  type OAuthProviderOptions,
  type RememberConsentOptions,
} from "@cloudflare/workers-oauth-provider";
import { Hono, type Context } from "hono";
import { html } from "hono/html";
import type { AppEnv, Bindings } from "./app";

/**
 * OAuth for Hermes's MCP connection (ADR 0007, issue #15), with Cloudflare's
 * `workers-oauth-provider`. The provider serves `/token`, `/register` and
 * `/.well-known/oauth-*`, and validates the bearer token on `/mcp`. `/authorize` is ours: it sits
 * behind the Access JWT check (`auth.ts`), so only the owner's Access login can approve a client,
 * and it shows a consent page first. The provider keeps its state in `OAUTH_KV`.
 */

/** The public origin Hermes connects to. The API worker itself has no public hostname. */
export const PUBLIC_ORIGIN = "https://app.culak.eu";

export const OAUTH_PATHS = {
  mcp: "/mcp",
  authorize: "/authorize",
  token: "/token",
  register: "/register",
} as const;

const DAY = 24 * 60 * 60;

/** What every grant carries into `/mcp` requests (`ctx.props`). There is one human user. */
export interface OAuthProps {
  actor: "owner";
  /** The Access JWT `sub` of the person who approved the client. */
  sub: string;
}

/** The provider's grant user id: a single fixed owner. */
export const OWNER_USER_ID = "owner";

export type OAuthOptions = Omit<OAuthProviderOptions<Bindings>, "apiHandler" | "defaultHandler">;

export const oauthOptions: OAuthOptions = {
  apiRoute: OAUTH_PATHS.mcp,
  authorizeEndpoint: OAUTH_PATHS.authorize,
  tokenEndpoint: OAUTH_PATHS.token,
  clientRegistrationEndpoint: OAUTH_PATHS.register,
  resourceMetadata: {
    resource: `${PUBLIC_ORIGIN}${OAUTH_PATHS.mcp}`,
    authorization_servers: [PUBLIC_ORIGIN],
    resource_name: "command-center",
  },
  accessTokenTTL: 60 * 60,
  // Rolling 30 days: every refresh moves the expiry, so Hermes stays connected while it is used.
  refreshTokenTTL: 30 * DAY,
  refreshTokenIdleTTL: 30 * DAY,
  // Default 90 days, renewed while the client keeps requesting tokens.
  clientRegistrationTTL: 90 * DAY,
};

/** Signs the "remember this approval" cookie. Remembering is off until it is set. */
export const CONSENT_SECRET_MIN_LENGTH = 32;

export interface OAuthBindings {
  /** Injected by the provider into `env` for its default handler. */
  OAUTH_PROVIDER?: OAuthHelpers;
  /** Worker secret, at least 32 characters. Without it every authorization shows the consent page. */
  OAUTH_CONSENT_SECRET?: string;
}

function rememberOptions(env: OAuthBindings, sub: string): RememberConsentOptions | null {
  const secret = env.OAUTH_CONSENT_SECRET;
  if (!secret || secret.length < CONSENT_SECRET_MIN_LENGTH) return null;
  return { secret, subject: sub, maxAgeSeconds: 30 * DAY };
}

/** The signed-in owner's Access subject; `accessAuth` has already verified the JWT. */
function accessSubject(c: Context<AppEnv>): string | null {
  const sub = c.get("accessJwt")?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
} as const;

function withPageHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(PAGE_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return headers;
}

const STYLE = `body{background:#09090b;color:#e4e4e7;font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem}
code,strong{font-family:ui-monospace,monospace}button{font:inherit;padding:.4rem 1rem;margin-right:.5rem}
.warn{color:#fbbf24}`;

/**
 * Every string from the client (name, redirect host) is self-asserted at `/register`, so it is
 * rendered only through Hono's `html` template, which escapes each interpolated value.
 */
function consentPage(details: ConsentDescription, handle: string) {
  return html`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect ${details.clientName}</title><style>${STYLE}</style></head>
<body>
<h1>Connect <strong>${details.clientName}</strong> to command-center?</h1>
<p>This app registered itself; its name is not verified.</p>
<p>Access will be sent to <strong>${details.redirectHost}</strong>.</p>
${details.redirectIsLoopback
    ? html`<p class="warn">This sends access to an app on a local machine. Continue only if you just started connecting it.</p>`
    : ""}
<p>It will be able to use every command-center MCP tool.</p>
<form method="post" action="/authorize">
<input type="hidden" name="handle" value="${handle}">
<button name="decision" value="approve">Allow</button><button name="decision" value="deny">Deny</button>
</form>
</body></html>`;
}

function errorPage(message: string) {
  return html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Cannot connect</title><style>${STYLE}</style></head>
<body><h1>Cannot connect</h1><p>${message}</p><p>Start the connection again from the app.</p></body></html>`;
}

async function renderError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return c.redirect(error.redirectTo, 302);
  }
  if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
    const message =
      error instanceof AuthorizationError
        ? "The authorization request is invalid, expired or was already used."
        : "This app could not be verified.";
    return new Response(String(await errorPage(message)), {
      status: 400,
      headers: withPageHeaders(new Headers()),
    });
  }
  throw error;
}

async function complete(oauth: OAuthHelpers, request: AuthRequest, sub: string) {
  const props: OAuthProps = { actor: "owner", sub };
  const { redirectTo } = await oauth.completeAuthorization({
    request,
    userId: OWNER_USER_ID,
    metadata: {},
    scope: request.scope,
    props,
  });
  return redirectTo;
}

/** `GET` and `POST /authorize`. They run after `accessAuth`, so a missing Access JWT is already a 401. */
export function authorizeRoutes() {
  return new Hono<AppEnv>()
    .get(OAUTH_PATHS.authorize, async (c) => {
      const oauth = c.env.OAUTH_PROVIDER;
      const sub = accessSubject(c);
      if (!oauth) return c.json({ error: "oauth is not configured" }, 500);
      if (!sub) return c.json({ error: "unauthorized" }, 401);
      try {
        const request = await oauth.parseAuthRequest(c.req.raw);
        const remember = rememberOptions(c.env, sub);
        if (remember && (await oauth.isConsentRemembered(c.req.raw, request, remember))) {
          return c.redirect(await complete(oauth, request, sub), 302);
        }
        // describeConsent first: a failed lookup leaves nothing in KV.
        const details = await oauth.describeConsent(request);
        const consent = await oauth.beginConsent(request);
        return new Response(String(await consentPage(details, consent.handle)), {
          status: 200,
          headers: withPageHeaders(consent.headers),
        });
      } catch (error) {
        return renderError(c, error);
      }
    })
    .post(OAUTH_PATHS.authorize, async (c) => {
      const oauth = c.env.OAUTH_PROVIDER;
      const sub = accessSubject(c);
      if (!oauth) return c.json({ error: "oauth is not configured" }, 500);
      if (!sub) return c.json({ error: "unauthorized" }, 401);
      const form = await c.req.formData().catch(() => null);
      const handle = form?.get("handle");
      const decision = form?.get("decision");
      if (typeof handle !== "string" || handle.length === 0 || handle.length > 512) {
        return c.json({ error: "invalid request" }, 400);
      }
      try {
        if (decision !== "approve") {
          const denied = await oauth.denyConsent(c.req.raw, handle);
          return new Response(null, { status: 302, headers: denied.headers });
        }
        const remember = rememberOptions(c.env, sub) ?? undefined;
        const approved = await oauth.approveConsent(c.req.raw, handle, { remember });
        const redirectTo = await complete(oauth, approved.request, sub);
        approved.headers.set("Location", redirectTo);
        return new Response(null, { status: 302, headers: approved.headers });
      } catch (error) {
        return renderError(c, error);
      }
    });
}
