import { parseAutomaticPushSource, notificationMatchesSource, type AutomaticPushSource } from "./automatic-source";
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
  gameAlerts?: boolean;
  directMessages?: boolean;
  source?: AutomaticPushSource;
}
export type PushConfiguration =
  | { enabled: false }
  | { enabled: true; publicKey: string; automatic?: AutomaticPushSource | null; directMessages?: boolean };
export interface PushEnvelope {
  version: 1;
  kind?: "test" | "game" | "direct-message";
  source?: AutomaticPushSource;
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
  if (input.gameAlerts !== undefined && typeof input.gameAlerts !== "boolean")
    throw new Error("invalid_push_registration");
  if (input.directMessages !== undefined && typeof input.directMessages !== "boolean")
    throw new Error("invalid_push_registration");
  return {
    ...(input.directMessages === undefined ? {} : { directMessages: input.directMessages }),
    ...(input.gameAlerts === undefined ? {} : { gameAlerts: input.gameAlerts }),
    ...(input.gameAlerts === true ? { source: parseAutomaticPushSource(input.source) } : {}),
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
  if (input.kind !== undefined && !isPushKind(input.kind)) throw new Error("invalid_push_kind");
  const notification = parseNotificationPayload(input.notification, now);
  const source = input.kind === "game" ? parseAutomaticPushSource(input.source) : undefined;
  if (source && !notificationMatchesSource(notification, source)) throw new Error("push_source_mismatch");
  return {
    version: 1,
    ...(source ? { source } : {}),
    ...(isPushKind(input.kind) ? { kind: input.kind } : {}),
    subscriptionId: input.subscriptionId,
    notification,
  };
}

function isPushKind(value: unknown): value is NonNullable<PushEnvelope["kind"]> {
  return value === "test" || value === "game" || value === "direct-message";
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_push_input");
  return value as Record<string, unknown>;
}
