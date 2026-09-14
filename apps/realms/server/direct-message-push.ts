import { timingSafeEqual } from "node:crypto";
import { Data, Effect } from "effect";
import {
  buildDirectMessageNotification,
  includesDirectMessageNotification,
  type PushEnvelope,
} from "@bibliothecadao/notifications";
import { serverEnv } from "./env";
import { notificationJson as json, readNotificationBody } from "./notification-http";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { PushSubscriptionStore } from "./push-subscription-store";
import { WebPushSender } from "./web-push-sender";

export function handleDirectMessagePush(request: Request): Promise<Response> {
  return Effect.runPromise(
    serveDirectMessagePush(request).pipe(
      Effect.provide(NotificationPreferenceStore.layer),
      Effect.provide(PushSubscriptionStore.layer),
      Effect.provide(WebPushSender.layer),
      Effect.catchTag("DirectMessagePushRequestError", (error) =>
        Effect.succeed(json({ error: error.code }, error.status)),
      ),
      Effect.catchTag("NotificationPreferenceStorageError", () =>
        Effect.succeed(json({ error: "preferences_unavailable" }, 503)),
      ),
      Effect.catchTag("PushStorageError", () => Effect.succeed(json({ error: "push_storage_unavailable" }, 503))),
    ),
  );
}

function serveDirectMessagePush(request: Request) {
  return Effect.gen(function* () {
    const secret = serverEnv.CHAT_NOTIFICATION_SECRET?.trim();
    if (!secret) return json({ error: "direct_message_push_disabled" }, 503);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!matchesBearerToken(request.headers.get("authorization"), secret)) return json({ error: "unauthorized" }, 401);
    const now = Date.now();
    const notification = yield* Effect.tryPromise({
      try: async () => buildDirectMessageNotification(JSON.parse(await readNotificationBody(request, 2048)), now),
      catch: () => new DirectMessagePushRequestError({ code: "invalid_direct_message", status: 400 }),
    });
    const preferences = yield* NotificationPreferenceStore;
    const preference = yield* preferences.read(notification.owner);
    if (!includesDirectMessageNotification(preference.level))
      return directMessagePushResponse({ accepted: 0, expired: 0, failed: 0, suppressed: true });
    const sender = yield* WebPushSender;
    if (!sender.configuration().enabled) return json({ error: "push_disabled" }, 503);
    const subscriptions = yield* PushSubscriptionStore;
    const devices = yield* subscriptions.findBackgroundDevices(notification.owner, now);
    const outcomes = yield* Effect.forEach(
      devices,
      (device) => {
        const envelope: PushEnvelope = {
          version: 1,
          kind: "direct-message",
          subscriptionId: device.id,
          notification,
        };
        return sender
          .send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, envelope)
          .pipe(Effect.catchTag("PushSendError", () => Effect.succeed("failed" as const)));
      },
      { concurrency: 8 },
    );
    yield* Effect.forEach(
      devices.filter((_, index) => outcomes[index] === "expired"),
      (device) => subscriptions.expire(device.owner, device.id),
    );
    return directMessagePushResponse({
      accepted: outcomes.filter((outcome) => outcome === "accepted").length,
      expired: outcomes.filter((outcome) => outcome === "expired").length,
      failed: outcomes.filter((outcome) => outcome === "failed").length,
      suppressed: devices.length === 0,
    });
  });
}

function directMessagePushResponse(result: {
  accepted: number;
  expired: number;
  failed: number;
  suppressed: boolean;
}): Response {
  console.info(JSON.stringify({ event: "direct_message_push", ...result }));
  return json(result, 202);
}

function matchesBearerToken(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

class DirectMessagePushRequestError extends Data.TaggedError("DirectMessagePushRequestError")<{
  code: string;
  status: number;
}> {}
