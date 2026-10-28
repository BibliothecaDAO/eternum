import * as Schema from "effect/Schema";
import { decodeNotification, notificationRecord, pushDeviceIdSchema, pushOwnerSchema } from "./validation";
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
}
/** Game alerts come from the shards in our directory; a device consents to them as a whole. */
export type PushConfiguration =
  | { enabled: false }
  | { enabled: true; publicKey: string; gameAlerts: boolean; directMessages: boolean };
export interface PushEnvelope {
  version: 1;
  kind?: "alerts-on" | "game" | "direct-message";
  subscriptionId: string;
  notification: LocalNotificationPayload;
}

const registrationSchema = Schema.Struct({
  owner: pushOwnerSchema,
  id: pushDeviceIdSchema,
  token: pushDeviceIdSchema,
  gameAlerts: Schema.optional(Schema.Boolean),
  directMessages: Schema.optional(Schema.Boolean),
  subscription: Schema.optional(Schema.Unknown),
});
const endpointSchema = Schema.String.check(Schema.isMaxLength(2048));
const providerSchema = Schema.URL.check(
  Schema.makeFilter(
    (url) =>
      (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)) &&
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash,
  ),
);
const keysSchema = Schema.Struct({
  p256dh: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{87}$/)),
  auth: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{22}$/)),
});
const envelopeSchema = Schema.Struct({
  version: Schema.Literal(1),
  subscriptionId: pushDeviceIdSchema,
  kind: Schema.optional(Schema.Unknown),
  notification: Schema.optional(Schema.Unknown),
});
const kindSchema = Schema.optional(Schema.Literals(["alerts-on", "game", "direct-message"]));

export const isPushDeviceId = Schema.is(pushDeviceIdSchema);
export const isPushOwner = Schema.is(pushOwnerSchema);

export function parsePushRegistration(value: unknown): PushRegistration {
  const record = decodeNotification(notificationRecord, value, "invalid_push_input");
  const input = decodeNotification(registrationSchema, record, "invalid_push_registration", "ignore");
  return {
    ...(input.directMessages === undefined ? {} : { directMessages: input.directMessages }),
    ...(input.gameAlerts === undefined ? {} : { gameAlerts: input.gameAlerts }),
    owner: input.owner,
    id: input.id,
    token: input.token,
    subscription: parseWebPushSubscription(input.subscription),
  };
}

export function parseWebPushSubscription(value: unknown): WebPushSubscription {
  const input = decodeNotification(notificationRecord, value, "invalid_push_input");
  const endpoint = decodeNotification(endpointSchema, input.endpoint, "invalid_push_endpoint");
  // Subscription URLs remain untrusted server egress destinations.
  const url = decodeNotification(providerSchema, new URL(endpoint), "unsupported_push_provider");
  const record = decodeNotification(notificationRecord, input.keys, "invalid_push_input");
  const keys = decodeNotification(keysSchema, record, "invalid_push_keys", "ignore");
  return { endpoint: url.href, keys };
}

export function parsePushEnvelope(value: unknown, now: number): PushEnvelope {
  const record = decodeNotification(notificationRecord, value, "invalid_push_input");
  const input = decodeNotification(envelopeSchema, record, "invalid_push_envelope", "ignore");
  const kind = decodeNotification(kindSchema, input.kind, "invalid_push_kind");
  return {
    version: 1,
    ...(kind === undefined ? {} : { kind }),
    subscriptionId: input.subscriptionId,
    notification: parseNotificationPayload(input.notification, now),
  };
}
