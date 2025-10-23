import { randomUUID } from "crypto";

import { and, desc, eq, gt, lt, or } from "drizzle-orm";
import { Hono } from "hono";

import {
  directMessageCreateSchema,
  directMessageHistoryQuerySchema,
  directMessageReadReceiptSchema,
  directMessageThreadQuerySchema,
  directMessageTypingSchema,
} from "@bibliothecadao/types";
import { db } from "../../db/client";
import {
  directMessageReadReceipts,
  directMessages,
  directMessageThreads,
  directMessageTypingStates,
} from "../../db/schema/direct-messages";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";

export const directMessageRoutes = new Hono<AppEnv>();

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

  let query = db.select().from(directMessageThreads);
  query = query.where(and(...filters)) as any;

  const limit = payload.limit ?? 50;

  const threads = await query
    .orderBy(desc(directMessageThreads.updatedAt ?? directMessageThreads.createdAt))
    .limit(limit);

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

  const [thread] = await db
    .select()
    .from(directMessageThreads)
    .where(eq(directMessageThreads.id, payload.threadId))
    .limit(1);

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

  const messages = await db
    .select()
    .from(directMessages)
    .where(and(...filters))
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);

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

  const aliases = player.aliases ?? [player.playerId];

  if (aliases.includes(payload.recipientId)) {
    return c.json({ error: "Cannot send a direct message to yourself." }, 400);
  }

  const expectedThreadId = buildThreadId(player.playerId, payload.recipientId);
  const providedThreadId = payload.threadId ?? expectedThreadId;

  const [existingThread] = await db
    .select()
    .from(directMessageThreads)
    .where(eq(directMessageThreads.id, providedThreadId))
    .limit(1);

  if (!existingThread && providedThreadId !== expectedThreadId) {
    return c.json({ error: "Thread id does not match participants." }, 400);
  }

  let thread = existingThread;
  let recipientId = payload.recipientId;

  if (thread) {
    const participants = [thread.playerAId, thread.playerBId];
    const participantSet = new Set(participants);
    const playerMatches = aliases.some((alias) => participantSet.has(alias));
    if (!playerMatches) {
      return c.json({ error: "Access denied." }, 403);
    }

    if (!participantSet.has(recipientId)) {
      const otherParticipant = participants.find((participant) => !aliases.includes(participant));
      if (!otherParticipant) {
        return c.json({ error: "Unable to determine thread recipient." }, 400);
      }
      recipientId = otherParticipant;
    }

    if (aliases.includes(recipientId)) {
      return c.json({ error: "Cannot send a direct message to yourself." }, 400);
    }
  } else {
    const participants = sortParticipants(player.playerId, recipientId);
    [thread] = await db
      .insert(directMessageThreads)
      .values({
        id: providedThreadId,
        playerAId: participants[0],
        playerBId: participants[1],
        unreadCounts: {
          [participants[0]]: 0,
          [participants[1]]: 0,
        },
      })
      .onConflictDoNothing()
      .returning();

    if (!thread) {
      [thread] = await db
        .select()
        .from(directMessageThreads)
        .where(eq(directMessageThreads.id, providedThreadId))
        .limit(1);
    }
  }

  if (!thread) {
    return c.json({ error: "Failed to resolve direct message thread." }, 500);
  }

  const messageId = randomUUID();
  const [message] = await db
    .insert(directMessages)
    .values({
      id: messageId,
      threadId: thread.id,
      senderId: player.playerId,
      recipientId,
      content: payload.content,
      metadata: payload.metadata ?? null,
    })
    .returning();

  const unreadCounts = {
    ...(thread.unreadCounts ?? {}),
    [recipientId]: (thread.unreadCounts?.[recipientId] ?? 0) + 1,
  };

  await db
    .update(directMessageThreads)
    .set({
      unreadCounts,
      lastMessageId: messageId,
      lastMessageAt: message.createdAt,
      updatedAt: message.createdAt,
    })
    .where(eq(directMessageThreads.id, thread.id));

  return c.json({ message }, 201);
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

  const [thread] = await db
    .select()
    .from(directMessageThreads)
    .where(eq(directMessageThreads.id, payload.threadId))
    .limit(1);

  if (!thread) {
    return c.json({ error: "Thread not found." }, 404);
  }

  const participantSet = new Set([thread.playerAId, thread.playerBId]);
  const isParticipant = player.aliases.some((alias) => participantSet.has(alias));
  if (!isParticipant) {
    return c.json({ error: "Access denied." }, 403);
  }

  const readAt = payload.readAt instanceof Date ? payload.readAt : new Date(payload.readAt);

  await db
    .insert(directMessageReadReceipts)
    .values({
      threadId: payload.threadId,
      messageId: payload.messageId,
      readerId: player.playerId,
      readAt,
      confirmed: true,
    })
    .onConflictDoUpdate({
      target: [
        directMessageReadReceipts.threadId,
        directMessageReadReceipts.messageId,
        directMessageReadReceipts.readerId,
      ],
      set: {
        readAt,
        confirmed: true,
      },
    });

  const unreadCounts = { ...(thread.unreadCounts ?? {}) };
  for (const alias of player.aliases) {
    unreadCounts[alias] = 0;
  }

  await db
    .update(directMessageThreads)
    .set({
      unreadCounts,
      updatedAt: readAt,
    })
    .where(eq(directMessageThreads.id, payload.threadId));

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

  if (!payload.isTyping) {
    await db
      .delete(directMessageTypingStates)
      .where(
        and(
          eq(directMessageTypingStates.threadId, payload.threadId),
          eq(directMessageTypingStates.playerId, payload.playerId),
        ),
      );
    return c.body(null, 204);
  }

  const expiresAt = new Date(Date.now() + 10_000);

  await db
    .insert(directMessageTypingStates)
    .values({
      threadId: payload.threadId,
      playerId: payload.playerId,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [directMessageTypingStates.threadId, directMessageTypingStates.playerId],
      set: {
        expiresAt,
      },
    });

  return c.body(null, 204);
});

export function buildThreadId(playerA: string, playerB: string): string {
  const [first, second] = sortParticipants(playerA, playerB);
  return `${first}|${second}`;
}

export function sortParticipants(playerA: string, playerB: string): [string, string] {
  return [playerA, playerB].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as [string, string];
}

export default directMessageRoutes;
