import { randomUUID } from "node:crypto";
import { Data, Effect } from "effect";
import {
  isPushDeviceId,
  isPushOwner,
  parseNotificationPayload,
  parsePushRegistration,
} from "@bibliothecadao/notifications";
import { auth } from "./auth";
import { notificationJson as json, readNotificationBody } from "./notification-http";
import { PushSubscriptionStore } from "./push-subscription-store";
import { WebPushSender } from "./web-push-sender";
import { createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const testLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

export function handlePushNotifications(request: Request, client: string): Promise<Response> {
  return Effect.runPromise(
    servePushRequest(request, client).pipe(
      Effect.provide(PushSubscriptionStore.layer),
      Effect.provide(WebPushSender.layer),
      Effect.catchTag("PushRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
      Effect.catchTag("PushStorageError", () => Effect.succeed(json({ error: "push_storage_unavailable" }, 503))),
      Effect.catchTag("PushSendError", () => Effect.succeed(json({ error: "push_provider_unavailable" }, 502))),
    ),
  );
}

function servePushRequest(request: Request, client: string) {
  return Effect.gen(function* () {
    const action = new URL(request.url).pathname.slice("/api/notifications/push/".length);
    const sender = yield* WebPushSender;
    if (action === "config" && request.method === "GET") return json(sender.configuration());
    if (!["subscribe", "status", "revoke", "test"].includes(action)) return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!limiter.allow(client)) return json({ error: "too_many_requests" }, 429);
    const input = yield* parsePushRequest(request);
    const store = yield* PushSubscriptionStore;
    // A persisted device capability can only revoke itself, including after logout or an account switch.
    if (action === "revoke") {
      if (!isPushDeviceId(input.id) || !isPushDeviceId(input.token)) return json({ error: "invalid_revocation" }, 400);
      yield* store.revoke(input.id, input.token);
      return json({ revoked: true });
    }
    const owner = yield* authenticatedOwner(request, input.owner);
    if (!sender.configuration().enabled) return json({ error: "push_disabled" }, 503);
    if (action === "subscribe") {
      const registration = yield* Effect.try({
        try: () => parsePushRegistration(input),
        catch: () => new PushRequestError({ code: "invalid_subscription", status: 400 }),
      });
      const result = yield* store.register(registration);
      return result === "registered" ? json({ id: registration.id }) : json({ error: `subscription_${result}` }, 409);
    }
    if (!isPushDeviceId(input.id)) return json({ error: "invalid_subscription_id" }, 400);
    if (action === "status") return json({ registered: !!(yield* store.find(owner, input.id)) });
    if (!testLimiter.allow(owner)) return json({ error: "too_many_tests" }, 429);
    const status = yield* sendPushTest(owner, input.id, input.target);
    return json({ status }, status === "expired" ? 410 : 200);
  });
}

/** Also used by the operator command, after the browser page has been closed. Test text is server-owned. */
export function sendPushTest(owner: string, id: string, target: unknown) {
  return Effect.gen(function* () {
    const now = Date.now();
    const notification = yield* Effect.try({
      try: () =>
        parseNotificationPayload(
          {
            version: 1,
            id: `push-test:${randomUUID()}`,
            owner,
            title: "Realms background notification",
            body: "This test was sent by the server. Game alerts still require an open page during this preview.",
            target,
            createdAt: now,
            expiresAt: now + 120_000,
          },
          now,
        ),
      catch: () => new PushRequestError({ code: "invalid_test_target", status: 400 }),
    });
    const store = yield* PushSubscriptionStore;
    const row = yield* store.find(owner, id);
    if (!row) return yield* Effect.fail(new PushRequestError({ code: "subscription_not_found", status: 404 }));
    const sender = yield* WebPushSender;
    const status = yield* sender.send(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      { version: 1, subscriptionId: id, notification },
    );
    if (status === "expired") yield* store.expire(owner, id);
    return status;
  });
}

function authenticatedOwner(request: Request, expected: unknown) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }),
      catch: () => new PushRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session) return yield* Effect.fail(new PushRequestError({ code: "unauthorized", status: 401 }));
    if (!isPushOwner(expected) || session.user.id !== expected)
      return yield* Effect.fail(new PushRequestError({ code: "owner_changed", status: 403 }));
    return expected;
  });
}
function parsePushRequest(request: Request) {
  return Effect.tryPromise({
    try: async (): Promise<Record<string, unknown>> => {
      if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
        throw new Error();
      const body: unknown = JSON.parse(await readNotificationBody(request, 4096));
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
      return body as Record<string, unknown>;
    },
    catch: () => new PushRequestError({ code: "invalid_push_request", status: 400 }),
  });
}
class PushRequestError extends Data.TaggedError("PushRequestError")<{ code: string; status: number }> {}
