/**
 * Cloudflare Access in front of the page decides who signs in; every API call still proves it here. The edge forwards
 * the signed-in user's token as `Cf-Access-Jwt-Assertion`; it is an RS256 JWT from the team's issuer, for the Access
 * application whose audience the route requires.
 */
interface AccessPolicy {
  teamDomain: string;
  audience: string;
}

export interface AccessIdentity {
  email: string;
}

export class AccessDenied extends Error {}

type Send = (url: string, init?: RequestInit) => Promise<Response>;

interface Jwk extends JsonWebKey {
  kid?: string;
}

const CERTS_TTL_MS = 10 * 60_000;
const certs = new Map<string, { keys: Jwk[]; until: number }>();

const decoder = new TextDecoder();
const base64url = (text: string): Uint8Array<ArrayBuffer> => {
  const base64 = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};
const json = (part: string): Record<string, unknown> => JSON.parse(decoder.decode(base64url(part)));

/** The team's signing keys, kept for a few minutes: Access rotates them with overlap. */
const signingKeys = async (teamDomain: string, send: Send, nowMs: number): Promise<Jwk[]> => {
  const cached = certs.get(teamDomain);
  if (cached && cached.until > nowMs) return cached.keys;
  return fetchSigningKeys(teamDomain, send, nowMs);
};

const fetchSigningKeys = async (teamDomain: string, send: Send, nowMs: number): Promise<Jwk[]> => {
  const response = await send(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certificates answered ${response.status}`);
  const { keys } = (await response.json()) as { keys?: Jwk[] };
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("Access published no signing keys");
  certs.set(teamDomain, { keys, until: nowMs + CERTS_TTL_MS });
  return keys;
};

/** The key a token names; a name the cached keys lack means Access rotated since, so the keys are read again once. */
const signingKey = async (teamDomain: string, kid: unknown, send: Send, nowMs: number): Promise<Jwk | undefined> => {
  const named = (keys: Jwk[]) => keys.find((key) => key.kid === kid);
  return named(await signingKeys(teamDomain, send, nowMs)) ?? named(await fetchSigningKeys(teamDomain, send, nowMs));
};

const hasAudience = (claim: unknown, audience: string) =>
  claim === audience || (Array.isArray(claim) && claim.includes(audience));

/** The signed-in operator, or AccessDenied for any token that is not a live one of this application. */
export const verifyAccess = async (
  token: string | null,
  policy: AccessPolicy,
  send: Send = fetch,
  nowMs = Date.now(),
): Promise<AccessIdentity> => {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 3) throw new AccessDenied("Sign in through Access");
  const [header, payload, signature] = parts as [string, string, string];
  const { alg, kid } = json(header);
  if (alg !== "RS256") throw new AccessDenied("Unexpected Access token algorithm");
  const jwk = await signingKey(policy.teamDomain, kid, send, nowMs);
  if (!jwk) throw new AccessDenied("Unknown Access signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const signed = new TextEncoder().encode(`${header}.${payload}`);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64url(signature), signed)))
    throw new AccessDenied("Access token signature is invalid");
  const claims = json(payload);
  const now = nowMs / 1000;
  if (claims.iss !== `https://${policy.teamDomain}`) throw new AccessDenied("Access token from another team");
  if (!hasAudience(claims.aud, policy.audience)) throw new AccessDenied("Access token for another application");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new AccessDenied("Access session expired");
  if (typeof claims.nbf === "number" && claims.nbf > now) throw new AccessDenied("Access token not yet valid");
  if (typeof claims.email !== "string" || claims.email === "") throw new AccessDenied("Access token names no user");
  return { email: claims.email };
};
