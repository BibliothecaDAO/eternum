import { Data, Effect } from "effect";
import { parseNotificationPreferences } from "@bibliothecadao/notifications";

import type { IdentityAuth } from "./auth";
import { json, readBody } from "./http";
import { NotificationPreferenceStore } from "./notification-preference-store";

/** GET and POST /api/notifications/preferences: the signed-in account's notification level, saved by revision. */
export function handleNotificationPreferences(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveNotificationPreferences(request, auth).pipe(
      Effect.provide(NotificationPreferenceStore.layer(db)),
      Effect.catchTag("NotificationPreferenceStorageError", () =>
        Effect.succeed(json({ error: "preferences_unavailable" }, 503)),
      ),
      Effect.catchTag("NotificationPreferenceRequestError", (error) =>
        Effect.succeed(json({ error: error.code }, error.status)),
      ),
    ),
  );
}

function serveNotificationPreferences(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: (cause) =>
        new NotificationPreferenceRequestError({ code: "authentication_unavailable", status: 503, cause }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    const store = yield* NotificationPreferenceStore;
    if (request.method === "GET") return json(yield* store.read(owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const change = yield* Effect.tryPromise({
      try: async () => parseNotificationPreferences(JSON.parse(await readBody(request, 1024))),
      catch: (cause) => new NotificationPreferenceRequestError({ code: "invalid_preferences", status: 400, cause }),
    });
    // Ownership is authenticated; this field prevents an account switch from retargeting an in-flight save.
    if (change.owner !== owner) return json({ error: "owner_changed" }, 403);
    const saved = yield* store.save(owner, change.level, change.revision);
    return saved ? json(saved) : json({ error: "preference_conflict" }, 409);
  });
}

class NotificationPreferenceRequestError extends Data.TaggedError("NotificationPreferenceRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
  readonly cause: unknown;
}> {}
