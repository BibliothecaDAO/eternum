import { Data, Effect } from "effect";
import { parseNotificationPreferences } from "@bibliothecadao/notifications";
import { auth } from "./auth";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { createRateLimiter } from "./rate-limit";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export function handleNotificationPreferences(request: Request): Promise<Response> {
  return Effect.runPromise(
    serveNotificationPreferences(request).pipe(
      Effect.provide(NotificationPreferenceStore.layer),
      Effect.catchTag("NotificationPreferenceStorageError", () =>
        Effect.succeed(json({ error: "preferences_unavailable" }, 503)),
      ),
      Effect.catchTag("NotificationPreferenceRequestError", (error) =>
        Effect.succeed(json({ error: error.code }, error.status)),
      ),
    ),
  );
}

function serveNotificationPreferences(request: Request) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }),
      catch: (cause) =>
        new NotificationPreferenceRequestError({ code: "authentication_unavailable", status: 503, cause }),
    });
    if (!session) return json({ error: "unauthorized" }, 401);
    const owner = session.user.id;
    if (!limiter.allow(owner)) return json({ error: "too_many_requests" }, 429);
    const store = yield* NotificationPreferenceStore;
    if (request.method === "GET") return json(yield* store.read(owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const change = yield* Effect.tryPromise({
      try: async () => parseNotificationPreferences(JSON.parse(await readBoundedPreferenceBody(request))),
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

async function readBoundedPreferenceBody(request: Request): Promise<string> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
