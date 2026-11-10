import { Buffer } from "node:buffer";
import type { PushEnvelope } from "@bibliothecadao/notifications";
import { pushTopic, SEND_TIMEOUT_MS, type PushOutcome } from "./web-push";

/** The team's APNs signing key (a .p8 file's PEM) and the ids Apple issued with it. */
export interface ApnsCredentials {
  teamId: string;
  keyId: string;
  privateKey: string;
}

/**
 * Production APNs: TestFlight and App Store builds hold production tokens. A development build's token is refused here
 * as BadDeviceToken and removed like any other dead token.
 */
const APNS_ORIGIN = "https://api.push.apple.com";
/** The iOS app's bundle id: APNs delivers only to the app the topic names. */
const APP_BUNDLE_ID = "party.realms.play";
/**
 * Apple accepts a provider token for an hour and refuses one renewed more often than every 20 minutes
 * (TooManyProviderTokenUpdates). Every isolate stamps its token with the same half hour, so together they renew it once.
 */
const PROVIDER_TOKEN_PERIOD_SECONDS = 30 * 60;

/**
 * Hands the envelope to APNs for the iOS app's device. The alert waits there until it expires, under a collapse id
 * named for its tag, so a newer alert of the same tag replaces one still waiting, as a Web Push Topic does. The
 * envelope rides beside the alert, so the app opens its target as the service worker does.
 */
export const sendApnsPush = async (
  credentials: ApnsCredentials,
  apnsToken: string,
  envelope: PushEnvelope,
  fetchPush: typeof fetch = fetch,
): Promise<PushOutcome> => {
  const remaining = envelope.notification.expiresAt - Date.now();
  if (remaining <= 0) return "rejected";
  const response = await fetchPush(`${APNS_ORIGIN}/3/device/${apnsToken}`, {
    method: "POST",
    headers: await apnsHeaders(credentials, envelope),
    body: JSON.stringify(apnsPayload(envelope)),
    redirect: "manual",
    signal: AbortSignal.timeout(Math.min(remaining, SEND_TIMEOUT_MS)),
  });
  return apnsOutcome(response);
};

const apnsHeaders = async (credentials: ApnsCredentials, envelope: PushEnvelope) => {
  const { notification } = envelope;
  return {
    authorization: `bearer ${await providerToken(credentials, Date.now())}`,
    "apns-topic": APP_BUNDLE_ID,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "apns-expiration": String(Math.floor(notification.expiresAt / 1000)),
    "apns-collapse-id": await pushTopic(notification.tag ?? notification.id),
    "content-type": "application/json",
  };
};

const apnsPayload = (envelope: PushEnvelope) => ({
  aps: { alert: { title: envelope.notification.title, body: envelope.notification.body }, sound: "default" },
  envelope,
});

/**
 * What APNs did with the alert (Apple's "Handling notification responses from APNs"). A token APNs no longer knows, or
 * never issued for this app, is gone for good; a refused provider token is our fault, never the device's.
 */
const apnsOutcome = async (response: Response): Promise<PushOutcome> => {
  if (response.ok) return "accepted";
  if (response.status === 410) return "expired";
  if (response.status === 429 || response.status >= 500) return "retry";
  if (response.status === 400 && DEAD_TOKEN_REASONS.has(await apnsReason(response))) return "expired";
  return "rejected";
};
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "DeviceTokenNotForTopic"]);

const apnsReason = async (response: Response) => {
  try {
    return String((await response.json<{ reason?: unknown }>()).reason);
  } catch {
    return "";
  }
};

let cachedProviderToken: { stamp: string; token: string } | null = null;

/** The ES256 JWT that authenticates every request (Apple's token-based connection to APNs). */
const providerToken = async (credentials: ApnsCredentials, now: number) => {
  const issuedAt = Math.floor(now / 1000 / PROVIDER_TOKEN_PERIOD_SECONDS) * PROVIDER_TOKEN_PERIOD_SECONDS;
  const stamp = `${credentials.teamId}:${credentials.keyId}:${issuedAt}`;
  if (cachedProviderToken?.stamp !== stamp)
    cachedProviderToken = { stamp, token: await signProviderToken(credentials, issuedAt) };
  return cachedProviderToken.token;
};

const signProviderToken = async (credentials: ApnsCredentials, issuedAt: number) => {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: credentials.keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: credentials.teamId, iat: issuedAt })).toString("base64url");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(credentials.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto's ECDSA signature is r || s, the encoding JWS requires.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${Buffer.from(signature).toString("base64url")}`;
};

/** The key's DER: the PEM's base64 between its armor lines. */
const pemBody = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----/g, ""), "base64");
