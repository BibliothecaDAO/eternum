import { parseNotificationPreferences } from "@bibliothecadao/notifications";
import { auth } from "./auth";
import { createNotificationPreferenceStore } from "./notification-preference-store";
import { createRateLimiter } from "./rate-limit";

const store = createNotificationPreferenceStore();
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleNotificationPreferences(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return json({ error: "unauthorized" }, 401);
  const owner = session.user.id;
  if (!limiter.allow(owner)) return json({ error: "too_many_requests" }, 429);
  if (request.method === "GET") return json(await store.read(owner));
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return json({ error: "json_required" }, 415);

  let change;
  try {
    change = parseNotificationPreferences(JSON.parse(await readBoundedPreferenceBody(request)));
  } catch {
    return json({ error: "invalid_preferences" }, 400);
  }
  // The owner is a precondition, never authority: a cookie/account switch must not retarget an in-flight save.
  if (change.owner !== owner) return json({ error: "owner_changed" }, 403);
  const saved = await store.save(owner, change.level, change.revision);
  return saved ? json(saved) : json({ error: "preference_conflict" }, 409);
}

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
