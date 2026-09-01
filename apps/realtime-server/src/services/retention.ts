import { and, isNull, lt, or } from "drizzle-orm";
import { Duration, Effect, Fiber, Schedule } from "effect";

import { directMessageThreads, directMessageTypingStates } from "../db/schema/direct-messages";
import { notes } from "../db/schema/notes";
import { worldChatMessages } from "../db/schema/world-chat";
import { databaseEffect } from "../effect/database";

const DAY_MS = 24 * 60 * 60 * 1_000;

const pruneExpiredChatData = ({ now = new Date(), retentionDays = 30 } = {}) => {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  return databaseEffect("prune expired chat data", (database) =>
    database.transaction(async (tx) => {
      await tx.delete(notes).where(lt(notes.expiresAt, now));
      await tx.delete(directMessageTypingStates).where(lt(directMessageTypingStates.expiresAt, now));
      await tx.delete(worldChatMessages).where(lt(worldChatMessages.createdAt, cutoff));
      await tx
        .delete(directMessageThreads)
        .where(
          or(
            lt(directMessageThreads.updatedAt, cutoff),
            and(isNull(directMessageThreads.updatedAt), lt(directMessageThreads.createdAt, cutoff)),
          ),
        );
    }),
  );
};

export const startChatRetention = ({
  retentionDays = Number(process.env.CHAT_RETENTION_DAYS ?? 30),
  intervalMs = Number(process.env.CHAT_RETENTION_INTERVAL_MS ?? 60 * 60 * 1_000),
} = {}) => {
  const prune = pruneExpiredChatData({ retentionDays }).pipe(
    Effect.catchAll((error) => Effect.logError("chat_prune_failed", error)),
  );
  const fiber = Effect.runFork(prune.pipe(Effect.repeat(Schedule.spaced(Duration.millis(intervalMs)))));
  return () => Effect.runFork(Fiber.interrupt(fiber));
};
