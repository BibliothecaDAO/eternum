import { Data, Effect } from "effect";
import {
  isPushDeviceId,
  isPushOwner,
  parseNotificationPayload,
  parsePushRegistration,
  type PushConfiguration,
} from "@bibliothecadao/notifications";

import type { IdentityAuth } from "./auth";
import { vapidKeysOf, type IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { PushSubscriptionStore } from "./push-subscription-store";
import { sendPush } from "./web-push";

const ACTIONS = ["subscribe", "status", "foreground", "revoke", "test"];

/**
 * GET /api/notifications/push/config and POST /api/notifications/push/:action — a device's push subscription for the
 * signed-in account. Game alerts are sent by each shard's notifier, direct messages by the recipient's chat inbox.
 */
export function handlePushSubscriptions(request: Request, auth: IdentityAuth, env: IdentityEnv): Promise<Response> {
  return Effect.runPromise(
    servePushRequest(request, auth, env).pipe(
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
      Effect.catchTag("PushRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
      Effect.catchTag("PushStorageError", () => Effect.succeed(json({ error: "push_storage_unavailable" }, 503))),
    ),
  );
}

function servePushRequest(request: Request, auth: IdentityAuth, env: IdentityEnv) {
  return Effect.gen(function* () {
    const action = new URL(request.url).pathname.slice("/api/notifications/push/".length);
    if (action === "config" && request.method === "GET") {
      const configuration: PushConfiguration = {
        enabled: true,
        publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY,
        gameAlerts: true,
        directMessages: true,
      };
      return json(configuration);
    }
    if (!ACTIONS.includes(action)) return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const input = yield* parsePushRequest(request);
    const store = yield* PushSubscriptionStore;
    // A persisted device capability can only revoke itself, including after logout or an account switch.
    if (action === "revoke") {
      if (!isPushDeviceId(input.id) || !isPushDeviceId(input.token)) return json({ error: "invalid_revocation" }, 400);
      yield* store.revoke(input.id, input.token);
      return json({ revoked: true });
    }
    const owner = yield* authenticatedOwner(request, auth, input.owner);
    if (action === "subscribe") {
      const registration = yield* Effect.try({
        try: () => parsePushRegistration(input),
        catch: () => new PushRequestError({ code: "invalid_subscription", status: 400 }),
      });
      const result = yield* store.register(registration);
      return result === "registered" ? json({ id: registration.id }) : json({ error: `subscription_${result}` }, 409);
    }
    if (!isPushDeviceId(input.id)) return json({ error: "invalid_subscription_id" }, 400);
    if (action === "status") {
      const subscription = yield* store.find(owner, input.id);
      return json({
        registered: !!subscription,
        directMessages: !!subscription?.directMessagesEnabledAt,
        gameAlerts: !!subscription?.gameAlertsEnabledAt,
      });
    }
    if (action === "test") return json({ status: yield* sendTestPush(env, owner, input.id) });
    if (typeof input.foreground !== "boolean") return json({ error: "invalid_foreground_status" }, 400);
    const found = yield* store.setGameForeground(owner, input.id, input.foreground);
    return found ? json({ foreground: input.foreground }) : json({ error: "subscription_not_found" }, 404);
  });
}

/** The account a device registers for is the signed-in one, named by its Realms id. */
function authenticatedOwner(request: Request, auth: IdentityAuth, expected: unknown) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }),
      catch: () => new PushRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return yield* new PushRequestError({ code: "unauthorized", status: 401 });
    if (!isPushOwner(expected) || session.user.realmsId !== expected)
      return yield* new PushRequestError({ code: "owner_changed", status: 403 });
    return expected;
  });
}

function parsePushRequest(request: Request) {
  return Effect.tryPromise({
    try: async (): Promise<Record<string, unknown>> => {
      if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
        throw new Error();
      const body: unknown = JSON.parse(await readBody(request, 4096));
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
      return body as Record<string, unknown>;
    },
    catch: () => new PushRequestError({ code: "invalid_push_request", status: 400 }),
  });
}

/** Server-owned text to the caller's own device, so a player can see a push arrive with the game closed. */
function sendTestPush(env: IdentityEnv, owner: string, id: string) {
  return Effect.gen(function* () {
    const store = yield* PushSubscriptionStore;
    const device = yield* store.find(owner, id);
    if (!device) return yield* new PushRequestError({ code: "subscription_not_found", status: 404 });
    const now = Date.now();
    const notification = parseNotificationPayload(
      {
        version: 1,
        id: `push-test:${crypto.randomUUID()}`,
        owner,
        title: "Realms background notification",
        body: "This test was sent by the server and can arrive with the game closed.",
        target: "/",
        createdAt: now,
        expiresAt: now + 120_000,
      },
      now,
    );
    const outcome = yield* Effect.tryPromise({
      try: () => sendPush(vapidKeysOf(env), device, { version: 1, kind: "test", subscriptionId: id, notification }),
      catch: () => new PushRequestError({ code: "push_provider_unavailable", status: 502 }),
    });
    if (outcome === "expired") yield* store.expire(owner, id);
    return outcome;
  });
}

class PushRequestError extends Data.TaggedError("PushRequestError")<{ code: string; status: number }> {}
