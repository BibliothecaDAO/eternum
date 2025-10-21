import { randomUUID } from "crypto";

import { and, desc, eq, gt, lt } from "drizzle-orm";
import { Hono } from "hono";

import { worldChatHistoryQuerySchema, worldChatPublishSchema } from "@bibliothecadao/types";
import { db } from "../../db/client";
import { worldChatMessages } from "../../db/schema/world-chat";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";

export const worldChatRoutes = new Hono<AppEnv>();

worldChatRoutes.use("/*", requirePlayerSession);

worldChatRoutes.get("/", async (c) => {
  const payloadResult = worldChatHistoryQuerySchema.safeParse({
    zoneId: c.req.query("zoneId"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    since: c.req.query("since"),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const filters = [];

  if (payload.zoneId) {
    filters.push(eq(worldChatMessages.zoneId, payload.zoneId));
  }

  if (payload.since) {
    const since = payload.since instanceof Date ? payload.since : new Date(payload.since);
    filters.push(gt(worldChatMessages.createdAt, since));
  }

  if (payload.cursor) {
    const cursorDate = new Date(payload.cursor);
    filters.push(lt(worldChatMessages.createdAt, cursorDate));
  }

  let query = db.select().from(worldChatMessages);
  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  const limit = payload.limit ?? 50;
  const messages = await query.orderBy(desc(worldChatMessages.createdAt)).limit(limit);

  const nextCursor = messages.length === limit ? messages[messages.length - 1]?.createdAt?.toISOString() : null;

  return c.json({
    messages,
    nextCursor,
  });
});

worldChatRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const payloadResult = worldChatPublishSchema.safeParse(body);

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const [created] = await db
    .insert(worldChatMessages)
    .values({
      id: randomUUID(),
      zoneId: payload.zoneId ?? null,
      senderId: player.playerId,
      senderWallet: player.walletAddress ?? null,
      senderDisplayName: player.displayName ?? null,
      content: payload.content,
      location: payload.location ?? null,
      metadata: payload.metadata ?? null,
    })
    .returning();

  return c.json({ message: created }, 201);
});

export default worldChatRoutes;
