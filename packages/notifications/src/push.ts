import { parseNotificationPayload, type LocalNotificationPayload } from "./delivery";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface PushRegistration {
  owner: string;
  id: string;
  token: string;
  subscription: WebPushSubscription;
}
export type PushConfiguration = { enabled: false } | { enabled: true; publicKey: string };
export interface PushEnvelope {
  version: 1;
  subscriptionId: string;
  notification: LocalNotificationPayload;
}

export function isPushDeviceId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}

export function parsePushRegistration(value: unknown): PushRegistration {
  const input = record(value);
  if (!isPushOwner(input.owner) || !isPushDeviceId(input.id) || !isPushDeviceId(input.token))
    throw new Error("invalid_push_registration");
  return {
    owner: input.owner,
    id: input.id,
    token: input.token,
    subscription: parseWebPushSubscription(input.subscription),
  };
}

export function isPushOwner(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-f]{1,64}$/.test(value);
}

export function parseWebPushSubscription(value: unknown): WebPushSubscription {
  const input = record(value);
  if (typeof input.endpoint !== "string" || input.endpoint.length > 2048) throw new Error("invalid_push_endpoint");
  const url = new URL(input.endpoint);
  // Subscription URLs are supplied by a browser but remain untrusted server egress destinations.
  const provider =
    ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
    /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (!provider || url.protocol !== "https:" || url.port || url.username || url.password || url.hash)
    throw new Error("unsupported_push_provider");
  const keys = record(input.keys);
  if (
    typeof keys.p256dh !== "string" ||
    !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) ||
    typeof keys.auth !== "string" ||
    !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)
  )
    throw new Error("invalid_push_keys");
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function parsePushEnvelope(value: unknown, now: number): PushEnvelope {
  const input = record(value);
  if (input.version !== 1 || !isPushDeviceId(input.subscriptionId)) throw new Error("invalid_push_envelope");
  return {
    version: 1,
    subscriptionId: input.subscriptionId,
    notification: parseNotificationPayload(input.notification, now),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_push_input");
  return value as Record<string, unknown>;
}
