import { Effect } from "effect";
import { buildMentionNotification, includesChatNotification } from "@bibliothecadao/notifications";
import type { MentionPlace } from "@bibliothecadao/notifications";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { mentionCandidates, profileOfIdentityUser } from "@realms-world/identity";

import { decodeIdentityEnv, vapidKeysOf } from "../env";
import type { IdentityEnv } from "../env";
import { NotificationPreferenceStore } from "../notification-preference-store";
import { PushSubscriptionStore } from "../push-subscription-store";
import { sendPush } from "../web-push";
import { slotRoomKey } from "./rooms";

/** A room message, as the room stored it. */
interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  createdAt: number;
}

/**
 * Where a room's mention is: Global, or a Blitz slot's lobby, rooms every signed-in player reads. A game's room has no
 * mention alert.
 */
const placeOf = (room: string): MentionPlace | null => {
  if (room === GLOBAL_CHAT_CHANNEL_ID) return { kind: "global" };
  const slot = slotRoomKey(room);
  return slot ? { kind: "lobby", slot: slot.name } : null;
};

/**
 * The accounts a message mentions, by their public names (unique, ignoring case): for each mention, the longest of the
 * names it may be that a player holds, as a reader's chat reads it. At most five mentions, each fewer than twenty names:
 * one statement, under D1's hundred parameters.
 */
const mentionedAccounts = async (db: D1Database, content: string): Promise<string[]> => {
  const mentions = mentionCandidates(content);
  const candidates = [...new Set(mentions.flat().map((name) => name.toLowerCase()))];
  if (candidates.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT "id", "name", "image", "realmsId" FROM "user"
         WHERE lower("name") IN (${candidates.map(() => "?").join(", ")}) AND "realmsId" IS NOT NULL`,
    )
    .bind(...candidates)
    .all<{ id: string; name: string; image: string | null; realmsId: string }>();
  const byName = new Map(
    results.flatMap((user) => {
      const name = profileOfIdentityUser(user).name;
      return name ? [[name.toLowerCase(), user.realmsId] as const] : [];
    }),
  );
  const accounts = mentions.flatMap((names) =>
    names.flatMap((candidate) => byName.get(candidate.toLowerCase()) ?? []).slice(0, 1),
  );
  return [...new Set(accounts)];
};

/**
 * A room message's mentions, told to each player mentioned who is not in the room to read it: on each device that takes
 * chat alerts, at their alert level, unless they muted the sender. Like a private message's alert, it names the sender
 * and the place, never the words.
 */
export const pushMentions = async (
  rawEnv: Record<string, unknown>,
  room: string,
  message: RoomMessage,
  inRoom: (realmsId: string) => boolean,
): Promise<void> => {
  const place = placeOf(room);
  if (!place) return;
  const env = decodeIdentityEnv(rawEnv);
  const targets = (await mentionedAccounts(env.DB, message.content)).filter(
    (realmsId) => realmsId !== message.senderId && !inRoom(realmsId),
  );
  if (targets.length === 0) return;
  await Effect.runPromise(
    Effect.gen(function* () {
      const levels = yield* (yield* NotificationPreferenceStore).levels(targets);
      const store = yield* PushSubscriptionStore;
      for (const owner of targets) {
        if (!includesChatNotification(levels.get(owner) ?? "off")) continue;
        const { blocked } = yield* Effect.promise(() => inboxOf(env, owner).blockList());
        if (blocked.includes(message.senderId)) continue;
        const notification = buildMentionNotification(
          {
            messageId: message.id,
            recipientOwner: owner,
            ...(message.senderName ? { senderDisplayName: message.senderName.slice(0, 64) } : {}),
            place,
            createdAt: message.createdAt,
          },
          Date.now(),
        );
        for (const device of yield* store.chatAlertDevices(owner, Date.now())) {
          const outcome = yield* Effect.promise(() =>
            sendPush(vapidKeysOf(env), device, {
              version: 1,
              kind: "mention",
              subscriptionId: device.id,
              notification,
            }),
          );
          if (outcome === "expired") yield* store.expire(owner, device.id);
        }
      }
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
      Effect.catchCause((cause) => Effect.sync(() => console.error("mention_push_failed", cause))),
    ),
  );
};

const inboxOf = (env: IdentityEnv, realmsId: string) => env.CHAT_INBOX.get(env.CHAT_INBOX.idFromName(realmsId));
