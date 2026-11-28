import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../src/app";
import { makeKey, signToken, TEST_TEAM_DOMAIN, accessHeaders } from "./helpers/access";
import {
  approve,
  authorizeUrl,
  call,
  consentHandle,
  cookiesFrom,
  exchangeCode,
  pkce,
  postConsent,
  REDIRECT_URI,
  registerClient,
  workerFor,
} from "./helpers/oauth";

/** A synthetic 32+ character consent secret, for the "remember" tests only. */
const withSecret: Bindings = {
  ...env,
  OAUTH_CONSENT_SECRET: "synthetic-consent-secret-0123456789abcdef",
};

async function freshClient(name?: string) {
  const worker = workerFor();
  const { client_id } = await registerClient(worker, name);
  const { verifier, challenge } = await pkce();
  return { worker, clientId: client_id, verifier, challenge };
}

describe("#15 /authorize requires a valid Access JWT before issuing a token", () => {
  describe("AC2: without a valid Access JWT, /authorize returns 401", () => {
    it("GET /authorize without the Access header is 401 and shows no consent page", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const res = await call(worker, authorizeUrl(clientId, challenge));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      expect(res.headers.get("Location")).toBeNull();
    });

    it("GET /authorize with a forged Access JWT is 401", async () => {
      const { worker, clientId, challenge } = await freshClient();
      await accessHeaders(env.OAUTH_KV); // seeds the team's real (synthetic) key
      const forger = await makeKey("kid-forged");
      const token = await signToken(forger, { host: TEST_TEAM_DOMAIN });
      const res = await call(worker, authorizeUrl(clientId, challenge), {
        headers: { "Cf-Access-Jwt-Assertion": token },
      });
      expect(res.status).toBe(401);
    });

    it("POST /authorize (approve) without the Access header is 401 and issues no code", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const access = await accessHeaders(env.OAUTH_KV);
      const page = await call(worker, authorizeUrl(clientId, challenge), { headers: access });
      const handle = consentHandle(await page.text());
      const res = await postConsent(worker, handle, "approve", { Cookie: cookiesFrom(page) });
      expect(res.status).toBe(401);
      expect(res.headers.get("Location")).toBeNull();
    });

    it("with a valid Access JWT, the approval redirects with a code that buys a token", async () => {
      const { worker, clientId, challenge, verifier } = await freshClient();
      const { location, consentShown } = await approve(worker, clientId, challenge);
      expect(consentShown).toBe(true);
      const redirect = new URL(location!);
      expect(`${redirect.origin}${redirect.pathname}`).toBe(REDIRECT_URI);
      expect(redirect.searchParams.get("state")).toBe("synthetic-state");
      const res = await exchangeCode(worker, clientId, redirect.searchParams.get("code")!, verifier);
      expect(res.status).toBe(200);
    });
  });

  describe("consent page", () => {
    it("escapes the self-registered client name and shows the redirect host", async () => {
      const { worker, clientId, challenge } = await freshClient('<script>alert("x")</script>');
      const res = await call(worker, authorizeUrl(clientId, challenge), {
        headers: await accessHeaders(env.OAUTH_KV),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("127.0.0.1");
      expect(html).toContain("local machine");
      expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });

    it("Deny redirects to the client with access_denied and no code", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const access = await accessHeaders(env.OAUTH_KV);
      const page = await call(worker, authorizeUrl(clientId, challenge), { headers: access });
      const res = await postConsent(worker, consentHandle(await page.text()), "deny", {
        ...access,
        Cookie: cookiesFrom(page),
      });
      expect(res.status).toBe(302);
      const redirect = new URL(res.headers.get("Location")!);
      expect(redirect.searchParams.get("error")).toBe("access_denied");
      expect(redirect.searchParams.get("code")).toBeNull();
    });

    it("a consent handle works once, and only in the browser that opened the page", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const access = await accessHeaders(env.OAUTH_KV);
      const page = await call(worker, authorizeUrl(clientId, challenge), { headers: access });
      const handle = consentHandle(await page.text());

      const otherBrowser = await postConsent(worker, handle, "approve", access);
      expect(otherBrowser.status).toBe(400);

      const headers = { ...access, Cookie: cookiesFrom(page) };
      expect((await postConsent(worker, handle, "approve", headers)).status).toBe(302);
      expect((await postConsent(worker, handle, "approve", headers)).status).toBe(400);
    });

    it("rejects a missing handle with 400", async () => {
      const { worker } = await freshClient();
      const res = await postConsent(worker, "", "approve", await accessHeaders(env.OAUTH_KV));
      expect(res.status).toBe(400);
    });

    it("an unknown client gets an error page, never a redirect", async () => {
      const { worker, challenge } = await freshClient();
      const res = await call(worker, authorizeUrl("synthetic-unknown-client", challenge), {
        headers: await accessHeaders(env.OAUTH_KV),
      });
      expect(res.status).toBe(400);
      expect(res.headers.get("Location")).toBeNull();
    });
  });

  describe("remembered consent (owner's choice: consent + remember)", () => {
    it("with OAUTH_CONSENT_SECRET set, a second authorization skips the page", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const first = await approve(worker, clientId, challenge, "", withSecret);
      expect(first.consentShown).toBe(true);
      const second = await approve(worker, clientId, challenge, first.cookie, withSecret);
      expect(second.consentShown).toBe(false);
      expect(new URL(second.location!).searchParams.get("code")).toEqual(expect.any(String));
    });

    it("without the secret, the page is shown every time", async () => {
      const { worker, clientId, challenge } = await freshClient();
      const first = await approve(worker, clientId, challenge);
      const second = await approve(worker, clientId, challenge, first.cookie);
      expect(second.consentShown).toBe(true);
    });

    it("a secret shorter than 32 characters does not enable remembering", async () => {
      const short: Bindings = { ...env, OAUTH_CONSENT_SECRET: "synthetic-too-short" };
      const { worker, clientId, challenge } = await freshClient();
      const first = await approve(worker, clientId, challenge, "", short);
      const second = await approve(worker, clientId, challenge, first.cookie, short);
      expect(second.consentShown).toBe(true);
    });
  });
});
