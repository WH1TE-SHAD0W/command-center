import { exportJWK, generateKeyPair, SignJWT, type JWK, type JWTPayload } from "jose";
import { jwksCacheKey } from "../../src/auth";

/**
 * Local, synthetic Cloudflare Access fixtures. Keys are generated in the test run; no real
 * tokens, team domains or AUD tags.
 */

export const TEST_AUD = "synthetic-aud-tag";
export const TEST_TEAM_DOMAIN = "synthetic-team.example.test";

export interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
}

export async function makeKey(kid: string): Promise<TestKey> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  return { kid, privateKey, publicJwk };
}

export interface TokenOptions {
  host?: string;
  issuer?: string;
  audience?: string;
  expiresAt?: number | string;
  claims?: JWTPayload;
}

export function signToken(key: TestKey, opts: TokenOptions = {}) {
  const host = opts.host ?? TEST_TEAM_DOMAIN;
  return new SignJWT({ email: "owner@example.test", ...opts.claims })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setIssuer(opts.issuer ?? `https://${host}`)
    .setAudience(opts.audience ?? TEST_AUD)
    .setIssuedAt()
    .setExpirationTime(opts.expiresAt ?? "5m")
    .sign(key.privateKey);
}

/** A fake fetch that serves the given keys as the team's certs and counts the calls. */
export function fakeCertsFetch(keys: () => JWK[]) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    return Response.json({ keys: keys() });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export async function seedJwks(
  kv: KVNamespace,
  host: string,
  keys: JWK[],
  fetchedAt = Date.now(),
) {
  await kv.put(jwksCacheKey(host), JSON.stringify({ jwks: { keys }, fetchedAt }));
}

let counter = 0;
/** A fresh synthetic team host per test, so tests never share KV cache entries. */
export const uniqueHost = () => `team-${Date.now()}-${++counter}.example.test`;
