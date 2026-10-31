import { Effect } from "effect";
import { parseNotificationPreferences } from "@bibliothecadao/notifications";

import type { IdentityAuth } from "./auth";
import { isJsonRequest, json, readJsonBody, Refusal, respond, signedIn } from "./http";
import { NotificationPreferenceStore } from "./notification-preference-store";

/** GET and POST /api/notifications/preferences: the signed-in account's notification level, saved by revision. */
export function handleNotificationPreferences(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return respond(
    serveNotificationPreferences(request, auth).pipe(
      Effect.provide(NotificationPreferenceStore.layer(db)),
      Effect.catchTag("NotificationPreferenceStorageError", () =>
        Effect.fail(new Refusal({ code: "preferences_unavailable", status: 503 })),
      ),
    ),
  );
}

function serveNotificationPreferences(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const { realmsId: owner } = yield* signedIn(auth, request);
    const store = yield* NotificationPreferenceStore;
    if (request.method === "GET") return json(yield* store.read(owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!isJsonRequest(request)) return json({ error: "json_required" }, 415);
    const body = yield* readJsonBody(request, 1024, "invalid_preferences");
    const change = yield* Effect.try({
      try: () => parseNotificationPreferences(body),
      catch: () => new Refusal({ code: "invalid_preferences", status: 400 }),
    });
    // Ownership is authenticated; this field prevents an account switch from retargeting an in-flight save.
    if (change.owner !== owner) return json({ error: "owner_changed" }, 403);
    const saved = yield* store.save(owner, change.level, change.revision);
    return saved ? json(saved) : json({ error: "preference_conflict" }, 409);
  });
}
