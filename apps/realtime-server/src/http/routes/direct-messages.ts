import { and, desc, eq, gt, lt, or } from "drizzle-orm";
import { Effect, Either } from "effect";
import { Hono } from "hono";

import {
  directMessageCreateSchema,
  directMessageHistoryQuerySchema,
  directMessageReadReceiptSchema,
  directMessageThreadQuerySchema,
  directMessageTypingSchema,
} from "@bibliothecadao/types";
import {
  directMessages,
  directMessageThreads,
  directMessageTypingStates,
  playerBlocks,
} from "../../db/schema/direct-messages";
import { DirectMessageError, markDirectMessageRead, persistDirectMessage } from "../../services/direct-messages";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";
import { databaseEffect } from "../../effect/database";

type DatabaseTask<A> = Parameters<typeof databaseEffect<A>>[1];

const runDatabaseAtHttpBoundary = <A>(operation: string, task: DatabaseTask<A>): Promise<A> =>
  Effect.runPromise(databaseEffect(operation, task));

const directMessageRoutes = new Hono<AppEnv>();

directMessageRoutes.use("/*", requirePlayerSession);

directMessageRoutes.get("/threads", async (c) => {
  const payloadResult = directMessageThreadQuerySchema.safeParse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    since: c.req.query("since"),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const identityFilters = player.aliases.flatMap((alias) => [
    eq(directMessageThreads.playerAId, alias),
    eq(directMessageThreads.playerBId, alias),
  ]);
  const participantFilter =
    identityFilters.length > 0
      ? or(...identityFilters)
      : or(eq(directMessageThreads.playerAId, player.playerId), eq(directMessageThreads.playerBId, player.playerId));

  const filters = [participantFilter];

  if (payload.since) {
    const since = payload.since instanceof Date ? payload.since : new Date(payload.since);
    filters.push(gt(directMessageThreads.updatedAt, since));
  }

  if (payload.cursor) {
    const cursorDate = new Date(payload.cursor);
    filters.push(lt(directMessageThreads.updatedAt, cursorDate));
  }

  const limit = payload.limit ?? 50;
  const threads = await runDatabaseAtHttpBoundary("read direct message threads", (database) =>
    database
      .select()
      .from(directMessageThreads)
      .where(and(...filters))
      .orderBy(desc(directMessageThreads.updatedAt ?? directMessageThreads.createdAt))
      .limit(limit),
  );

  const nextCursor =
    threads.length === limit
      ? ((threads[threads.length - 1]?.updatedAt ?? threads[threads.length - 1]?.createdAt)?.toISOString() ?? null)
      : null;

  return c.json({
    threads,
    nextCursor,
  });
});

directMessageRoutes.get("/threads/:threadId/messages", async (c) => {
  const payloadResult = directMessageHistoryQuerySchema.safeParse({
    threadId: c.req.param("threadId"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    since: c.req.query("since"),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const [thread] = await runDatabaseAtHttpBoundary("read direct message thread", (database) =>
    database.select().from(directMessageThreads).where(eq(directMessageThreads.id, payload.threadId)).limit(1),
  );

  if (!thread) {
    return c.json({ error: "Thread not found." }, 404);
  }

  const participantSet = new Set([thread.playerAId, thread.playerBId]);
  const isParticipant = player.aliases.some((alias) => participantSet.has(alias));
  if (!isParticipant) {
    return c.json({ error: "Access denied." }, 403);
  }

  const filters = [eq(directMessages.threadId, payload.threadId)];

  if (payload.since) {
    const since = payload.since instanceof Date ? payload.since : new Date(payload.since);
    filters.push(gt(directMessages.createdAt, since));
  }

  if (payload.cursor) {
    const cursorDate = new Date(payload.cursor);
    filters.push(lt(directMessages.createdAt, cursorDate));
  }

  const limit = payload.limit ?? 100;

  const messages = await runDatabaseAtHttpBoundary("read direct messages", (database) =>
    database
      .select()
      .from(directMessages)
      .where(and(...filters))
      .orderBy(desc(directMessages.createdAt))
      .limit(limit),
  );

  const nextCursor = messages.length === limit ? messages[messages.length - 1]?.createdAt?.toISOString() : null;

  return c.json({
    thread,
    messages,
    nextCursor,
  });
});

directMessageRoutes.post("/messages", async (c) => {
  const body = await c.req.json().catch(() => null);
  const payloadResult = directMessageCreateSchema.safeParse(body);

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const result = await Effect.runPromise(Effect.either(persistDirectMessage(player, payload)));
  if (Either.isLeft(result)) {
    if (result.left instanceof DirectMessageError) {
      return c.json({ error: result.left.message, code: result.left.code }, result.left.status);
    }
    throw result.left;
  }
  return c.json({ message: result.right.message, thread: result.right.thread }, 201);
});

directMessageRoutes.post("/blocks/:playerId", async (c) => {
  const player = c.get("playerSession")!;
  const blockedId = c.req.param("playerId");
  if (blockedId === player.playerId) return c.json({ error: "Cannot block yourself." }, 400);
  const payloadResult = directMessageCreateSchema.pick({ recipientId: true }).safeParse({ recipientId: blockedId });
  if (!payloadResult.success) return c.json(formatZodError(payloadResult.error), 400);
  await runDatabaseAtHttpBoundary("block direct message player", (database) =>
    database.insert(playerBlocks).values({ blockerId: player.playerId, blockedId }).onConflictDoNothing(),
  );
  return c.body(null, 204);
});

directMessageRoutes.delete("/blocks/:playerId", async (c) => {
  const player = c.get("playerSession")!;
  await runDatabaseAtHttpBoundary("unblock direct message player", (database) =>
    database
      .delete(playerBlocks)
      .where(and(eq(playerBlocks.blockerId, player.playerId), eq(playerBlocks.blockedId, c.req.param("playerId")))),
  );
  return c.body(null, 204);
});

directMessageRoutes.post("/threads/:threadId/read", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const payloadResult = directMessageReadReceiptSchema.safeParse({
    threadId: c.req.param("threadId"),
    messageId: body?.messageId,
    readerId: c.get("playerSession")?.playerId,
    readAt: body?.readAt ?? new Date().toISOString(),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;

  const player = c.get("playerSession")!;

  if (payload.readerId !== player.playerId) {
    return c.json({ error: "Cannot acknowledge read for another player." }, 403);
  }

  const result = await Effect.runPromise(Effect.either(markDirectMessageRead(player, payload)));
  if (Either.isLeft(result)) {
    if (result.left instanceof DirectMessageError) {
      return c.json({ error: result.left.message, code: result.left.code }, result.left.status);
    }
    throw result.left;
  }

  return c.body(null, 204);
});

directMessageRoutes.post("/threads/:threadId/typing", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const payloadResult = directMessageTypingSchema.safeParse({
    threadId: c.req.param("threadId"),
    playerId: c.get("playerSession")?.playerId,
    isTyping: body?.isTyping,
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;

  const [thread] = await runDatabaseAtHttpBoundary("read typing thread", (database) =>
    database.select().from(directMessageThreads).where(eq(directMessageThreads.id, payload.threadId)).limit(1),
  );
  if (!thread) return c.json({ error: "Thread not found." }, 404);
  if (![thread.playerAId, thread.playerBId].includes(payload.playerId)) {
    return c.json({ error: "Access denied." }, 403);
  }

  if (!payload.isTyping) {
    await runDatabaseAtHttpBoundary("clear direct message typing", (database) =>
      database
        .delete(directMessageTypingStates)
        .where(
          and(
            eq(directMessageTypingStates.threadId, payload.threadId),
            eq(directMessageTypingStates.playerId, payload.playerId),
          ),
        ),
    );
    return c.body(null, 204);
  }

  const expiresAt = new Date(Date.now() + 10_000);

  await runDatabaseAtHttpBoundary("write direct message typing", (database) =>
    database
      .insert(directMessageTypingStates)
      .values({ threadId: payload.threadId, playerId: payload.playerId, expiresAt })
      .onConflictDoUpdate({
        target: [directMessageTypingStates.threadId, directMessageTypingStates.playerId],
        set: { expiresAt },
      }),
  );

  return c.body(null, 204);
});

export default directMessageRoutes;
