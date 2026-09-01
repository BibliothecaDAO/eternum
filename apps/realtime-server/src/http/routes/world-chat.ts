import { randomUUID } from "crypto";

import { and, desc, eq, gt, lt, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { Effect } from "effect";

import { worldChatHistoryQuerySchema, worldChatPublishSchema } from "@bibliothecadao/types";
import { worldChatMessages } from "../../db/schema/world-chat";
import { parseGameChannel } from "../../channels/channel";
import type { MembershipResolver } from "../../channels/membership";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";
import { databaseEffect } from "../../effect/database";

export const createWorldChatRoutes = (membership: MembershipResolver) => {
  const worldChatRoutes = new Hono<AppEnv>();
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
    const player = c.get("playerSession")!;
    if (!parseGameChannel(payload.zoneId)) return c.json({ error: "A valid game channel is required." }, 400);
    if (
      !player.membershipPlayerId ||
      !(await Effect.runPromise(membership.isMember(player.membershipPlayerId, payload.zoneId)))
    ) {
      return c.json({ error: "Channel membership required." }, 403);
    }
    const filters: SQL[] = [eq(worldChatMessages.zoneId, payload.zoneId)];

    if (payload.since) {
      const since = payload.since instanceof Date ? payload.since : new Date(payload.since);
      filters.push(gt(worldChatMessages.createdAt, since));
    }

    if (payload.cursor) {
      const cursorDate = new Date(payload.cursor);
      filters.push(lt(worldChatMessages.createdAt, cursorDate));
    }

    const limit = payload.limit ?? 50;
    const messages = await Effect.runPromise(
      databaseEffect("read game chat history", (database) =>
        database
          .select()
          .from(worldChatMessages)
          .where(and(...filters))
          .orderBy(desc(worldChatMessages.createdAt))
          .limit(limit),
      ),
    );

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
    if (!parseGameChannel(payload.zoneId)) return c.json({ error: "A valid game channel is required." }, 400);
    if (
      !player.membershipPlayerId ||
      !(await Effect.runPromise(membership.isMember(player.membershipPlayerId, payload.zoneId)))
    ) {
      return c.json({ error: "Channel membership required." }, 403);
    }

    const [created] = await Effect.runPromise(
      databaseEffect("publish game chat message", (database) =>
        database
          .insert(worldChatMessages)
          .values({
            id: randomUUID(),
            zoneId: payload.zoneId ?? null,
            senderId: player.playerId,
            senderDisplayName: player.displayName ?? null,
            content: payload.content,
            location: payload.location ?? null,
            metadata: payload.metadata ?? null,
          })
          .returning(),
      ),
    );

    return c.json({ message: created }, 201);
  });

  return worldChatRoutes;
};
