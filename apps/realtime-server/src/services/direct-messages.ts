import { randomUUID } from "crypto";

import { and, eq, or } from "drizzle-orm";
import { Effect } from "effect";

import type { DirectMessageCreatePayload, DirectMessageReadReceipt } from "@bibliothecadao/types";
import {
  directMessageReadReceipts,
  directMessages,
  directMessageThreads,
  playerBlocks,
  type DirectMessageRecord,
  type DirectMessageThreadRecord,
} from "../db/schema/direct-messages";
import type { PlayerSession } from "../http/middleware/auth";
import { databaseEffect } from "../effect/database";
import { DatabaseFailure, DirectMessageRejected } from "../effect/errors";

export { DirectMessageRejected as DirectMessageError } from "../effect/errors";

export const sortParticipants = (playerA: string, playerB: string): [string, string] =>
  [playerA, playerB].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as [string, string];

export const buildThreadId = (playerA: string, playerB: string): string => sortParticipants(playerA, playerB).join("|");

export const isBlockedPair = (
  blocks: ReadonlyArray<{ blockerId: string; blockedId: string }>,
  playerA: string,
  playerB: string,
): boolean =>
  blocks.some(
    ({ blockerId, blockedId }) =>
      (blockerId === playerA && blockedId === playerB) || (blockerId === playerB && blockedId === playerA),
  );

export const isThreadRecipient = (
  participants: readonly string[],
  senderAliases: readonly string[],
  recipientId: string,
): boolean => participants.includes(recipientId) && !senderAliases.includes(recipientId);

export const persistDirectMessage = (
  session: PlayerSession,
  payload: DirectMessageCreatePayload,
): Effect.Effect<
  { message: DirectMessageRecord; thread: DirectMessageThreadRecord; participants: [string, string] },
  DatabaseFailure | DirectMessageRejected
> =>
  Effect.gen(function* () {
    if (session.aliases.includes(payload.recipientId)) {
      return yield* new DirectMessageRejected({
        code: "direct_self_message",
        message: "Cannot send a message to yourself.",
        status: 400,
      });
    }
    const expectedThreadId = buildThreadId(session.playerId, payload.recipientId);
    const providedThreadId = payload.threadId ?? expectedThreadId;

    return yield* databaseEffect("persist direct message", (database) =>
      database.transaction(async (tx) => {
        const loadThreadForUpdate = async (): Promise<DirectMessageThreadRecord | undefined> => {
          const [thread] = await tx
            .select()
            .from(directMessageThreads)
            .where(eq(directMessageThreads.id, providedThreadId))
            .limit(1)
            .for("update");
          return thread;
        };

        let thread = await loadThreadForUpdate();
        if (!thread && providedThreadId !== expectedThreadId) {
          throw new DirectMessageRejected({
            code: "direct_thread_mismatch",
            message: "Thread id does not match participants.",
            status: 400,
          });
        }
        if (!thread) {
          const participants = sortParticipants(session.playerId, payload.recipientId);
          [thread] = await tx
            .insert(directMessageThreads)
            .values({
              id: providedThreadId,
              playerAId: participants[0],
              playerBId: participants[1],
              unreadCounts: { [participants[0]]: 0, [participants[1]]: 0 },
            })
            .onConflictDoNothing()
            .returning();
          if (!thread) thread = await loadThreadForUpdate();
        }
        if (!thread) {
          throw new DirectMessageRejected({
            code: "direct_thread_failed",
            message: "Failed to resolve direct message thread.",
            status: 500,
          });
        }

        const participants = [thread.playerAId, thread.playerBId] as [string, string];
        if (!session.aliases.some((alias) => participants.includes(alias))) {
          throw new DirectMessageRejected({
            code: "direct_access_denied",
            message: "You are not a participant in this thread.",
            status: 403,
          });
        }
        const recipientId = payload.recipientId;
        if (!isThreadRecipient(participants, session.aliases, recipientId)) {
          throw new DirectMessageRejected({
            code: "direct_thread_mismatch",
            message: "Thread id does not match participants.",
            status: 400,
          });
        }
        const blocks = await tx
          .select({ blockerId: playerBlocks.blockerId, blockedId: playerBlocks.blockedId })
          .from(playerBlocks)
          .where(
            or(
              and(eq(playerBlocks.blockerId, session.playerId), eq(playerBlocks.blockedId, recipientId)),
              and(eq(playerBlocks.blockerId, recipientId), eq(playerBlocks.blockedId, session.playerId)),
            ),
          )
          .limit(1);
        if (isBlockedPair(blocks, session.playerId, recipientId)) {
          throw new DirectMessageRejected({
            code: "direct_blocked",
            message: "Direct messages are blocked between these players.",
            status: 403,
          });
        }
        const [message] = await tx
          .insert(directMessages)
          .values({
            id: randomUUID(),
            threadId: thread.id,
            senderId: session.playerId,
            recipientId,
            content: payload.content,
            metadata: payload.metadata ?? null,
          })
          .returning();
        if (!message) {
          throw new DirectMessageRejected({
            code: "direct_message_failed",
            message: "Unable to persist direct message.",
            status: 500,
          });
        }

        const unreadCounts = {
          ...(thread.unreadCounts ?? {}),
          [recipientId]: (thread.unreadCounts?.[recipientId] ?? 0) + 1,
        };
        const [updatedThread] = await tx
          .update(directMessageThreads)
          .set({
            unreadCounts,
            lastMessageId: message.id,
            lastMessageAt: message.createdAt,
            updatedAt: message.createdAt,
          })
          .where(eq(directMessageThreads.id, thread.id))
          .returning();
        if (!updatedThread) {
          throw new DirectMessageRejected({
            code: "direct_thread_failed",
            message: "Unable to update direct thread.",
            status: 500,
          });
        }
        return { message, thread: updatedThread, participants };
      }),
    );
  });

export const markDirectMessageRead = (
  session: PlayerSession,
  receipt: DirectMessageReadReceipt,
): Effect.Effect<void, DatabaseFailure | DirectMessageRejected> =>
  databaseEffect("mark direct message read", (database) =>
    database.transaction(async (tx) => {
      const [thread] = await tx
        .select()
        .from(directMessageThreads)
        .where(eq(directMessageThreads.id, receipt.threadId))
        .limit(1)
        .for("update");
      if (!thread) {
        throw new DirectMessageRejected({ code: "direct_thread_missing", message: "Thread not found.", status: 404 });
      }
      const participants = new Set([thread.playerAId, thread.playerBId]);
      if (!session.aliases.some((alias) => participants.has(alias))) {
        throw new DirectMessageRejected({
          code: "direct_access_denied",
          message: "You are not a participant in this thread.",
          status: 403,
        });
      }

      const readAt = receipt.readAt instanceof Date ? receipt.readAt : new Date(receipt.readAt);
      await tx
        .insert(directMessageReadReceipts)
        .values({
          threadId: receipt.threadId,
          messageId: receipt.messageId,
          readerId: session.playerId,
          readAt,
          confirmed: true,
        })
        .onConflictDoUpdate({
          target: [
            directMessageReadReceipts.threadId,
            directMessageReadReceipts.messageId,
            directMessageReadReceipts.readerId,
          ],
          set: { readAt, confirmed: true },
        });

      const unreadCounts = { ...(thread.unreadCounts ?? {}) };
      for (const alias of session.aliases) unreadCounts[alias] = 0;
      await tx
        .update(directMessageThreads)
        .set({ unreadCounts, updatedAt: readAt })
        .where(eq(directMessageThreads.id, receipt.threadId));
    }),
  );
