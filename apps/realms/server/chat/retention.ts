import type { IdentityEnv } from "../env";
import { json, readBody } from "../http";
import { CHAT_OBJECT_CLASSES, CHAT_RETENTION_BATCH, type ChatObjectClass } from "./chat-objects";

/**
 * Chat keeps a message thirty days, in a room and in each inbox, and then deletes it. An object deletes what is past
 * that before it answers a read and after each new message, and its alarm wakes it when its oldest message turns thirty
 * days, so a room or an inbox nobody opens again empties too. The alarm is one wake per expiry; nothing else runs while
 * the object is quiet.
 *
 * Each deploy also calls every chat object Cloudflare holds (`handleChatRetention`), so one written before this rule
 * existed, which has no alarm, keeps the same thirty days without waiting for a player to open it.
 */
export const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The time at or before which a message is past retention: one written thirty days ago is gone at its alarm. */
export const retentionCutoff = (now = Date.now()) => now - CHAT_RETENTION_MS;

/** Sets the object's alarm to when its oldest message (null: none left) turns thirty days, or clears it. */
export const wakeAtNextExpiry = async (storage: DurableObjectStorage, oldest: number | null): Promise<void> => {
  if (oldest === null) return storage.deleteAlarm();
  const expiry = oldest + CHAT_RETENTION_MS;
  if ((await storage.getAlarm()) !== expiry) await storage.setAlarm(expiry);
};

const OBJECT_ID = /^[0-9a-f]{64}$/;

const retentionPasses = (env: IdentityEnv): Record<ChatObjectClass, (id: string) => Promise<void>> => ({
  ChatRoom: (id) => env.CHAT_ROOM.get(env.CHAT_ROOM.idFromString(id)).forgetExpired(),
  ChatInbox: (id) => env.CHAT_INBOX.get(env.CHAT_INBOX.idFromString(id)).forgetExpired(),
});

const readRetentionCall = (body: unknown): { className: ChatObjectClass; ids: string[] } | null => {
  const { className, ids } = (body ?? {}) as { className?: unknown; ids?: unknown };
  const isClass = CHAT_OBJECT_CLASSES.some((name) => name === className);
  const isIdList =
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= CHAT_RETENTION_BATCH &&
    ids.every((id) => typeof id === "string" && OBJECT_ID.test(id));
  return isClass && isIdList ? { className: className as ChatObjectClass, ids: ids as string[] } : null;
};

/**
 * POST /api/operator/chat-retention `{ className, ids }`, as the operator: each named object deletes its messages
 * past thirty days and sets its alarm for the rest. Safe to run again: a second pass changes nothing.
 */
export const handleChatRetention = async (request: Request, env: IdentityEnv): Promise<Response> => {
  const body: unknown = await readBody(request, 16 * 1024)
    .then((text) => JSON.parse(text))
    .catch(() => null);
  const call = readRetentionCall(body);
  if (!call) return json({ error: "invalid_chat_retention" }, 400);
  await Promise.all(call.ids.map(retentionPasses(env)[call.className]));
  return json({ kept: call.ids.length });
};
