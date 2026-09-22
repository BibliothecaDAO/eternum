import { Data, Effect } from "effect";
import {
  isPushDeviceId,
  isPushOwner,
  parseAutomaticPushSource,
  parsePushRegistration,
} from "@bibliothecadao/notifications";

import type { IdentityAuth } from "./auth";
import { json, readBody } from "./http";
import { PushSubscriptionStore } from "./push-subscription-store";

const ACTIONS = ["subscribe", "status", "foreground", "revoke"];

/**
 * POST /api/notifications/push/:action — a device's push subscription for the signed-in account. Sending lives with
 * the notification sources, not here, so GET config reports it off.
 */
export function handlePushSubscriptions(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    servePushRequest(request, auth).pipe(
      Effect.provide(PushSubscriptionStore.layer(db)),
      Effect.catchTag("PushRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
      Effect.catchTag("PushStorageError", () => Effect.succeed(json({ error: "push_storage_unavailable" }, 503))),
    ),
  );
}

function servePushRequest(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const action = new URL(request.url).pathname.slice("/api/notifications/push/".length);
    // No push is sent from here; devices can still register state and always revoke themselves.
    if (action === "config" && request.method === "GET") return json({ enabled: false });
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
        automatic:
          subscription?.gameAlertsEnabledAt && subscription.gameAlertsSource
            ? parseAutomaticPushSource(subscription.gameAlertsSource)
            : null,
      });
    }
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

class PushRequestError extends Data.TaggedError("PushRequestError")<{ code: string; status: number }> {}
