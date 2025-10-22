import { randomUUID } from "crypto";

import { and, desc, eq, gt, lt, or } from "drizzle-orm";
import { Hono } from "hono";

import { noteCreateSchema, noteDeleteSchema, noteListQuerySchema, noteUpdateSchema } from "@bibliothecadao/types";
import { db } from "../../db/client";
import { notes } from "../../db/schema/notes";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";

export const notesRoutes = new Hono<AppEnv>();

notesRoutes.use("/*", requirePlayerSession);

notesRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const payloadResult = noteCreateSchema.safeParse(body);

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;
  const now = new Date();

  try {
    const [created] = await db
      .insert(notes)
      .values({
        id: randomUUID(),
        authorId: player.playerId,
        zoneId: payload.zoneId,
        title: payload.title,
        content: payload.content,
        location: payload.location,
        metadata: payload.metadata ?? null,
        expiresAt: payload.expiresAt
          ? payload.expiresAt instanceof Date
            ? payload.expiresAt
            : new Date(payload.expiresAt)
          : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ note: created }, 201);
  } catch (error) {
    console.error("Failed to create note", error);
    return c.json({ error: "Failed to create note." }, 500);
  }
});

notesRoutes.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const payloadResult = noteUpdateSchema.safeParse({
    ...body,
    id: c.req.param("id"),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const authorAliases = player.aliases ?? [player.playerId];
  const authorConditions = authorAliases.map((alias) => eq(notes.authorId, alias));
  const authorFilter =
    authorConditions.length > 0 ? or(...authorConditions) : eq(notes.authorId, player.playerId);

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, payload.id), authorFilter))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Note not found." }, 404);
  }

  const changes = {
    title: payload.title ?? existing.title,
    content: payload.content ?? existing.content,
    expiresAt: payload.expiresAt
      ? payload.expiresAt instanceof Date
        ? payload.expiresAt
        : new Date(payload.expiresAt)
      : existing.expiresAt,
    metadata: payload.metadata ?? existing.metadata,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(notes).set(changes).where(eq(notes.id, payload.id)).returning();

  return c.json({ note: updated });
});

notesRoutes.delete("/:id", async (c) => {
  const payloadResult = noteDeleteSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!payloadResult.success) {
    return c.json(formatZodError(payloadResult.error), 400);
  }

  const payload = payloadResult.data;
  const player = c.get("playerSession")!;

  const authorAliases = player.aliases ?? [player.playerId];
  const authorConditions = authorAliases.map((alias) => eq(notes.authorId, alias));
  const authorFilter =
    authorConditions.length > 0 ? or(...authorConditions) : eq(notes.authorId, player.playerId);

  const { rowCount } = await db.delete(notes).where(and(eq(notes.id, payload.id), authorFilter));

  if (rowCount === 0) {
    return c.json({ error: "Note not found." }, 404);
  }

  return c.body(null, 204);
});

notesRoutes.get("/", async (c) => {
  const payloadResult = noteListQuerySchema.safeParse({
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
    filters.push(eq(notes.zoneId, payload.zoneId));
  }

  if (payload.since) {
    const since = payload.since instanceof Date ? payload.since : new Date(payload.since);
    filters.push(gt(notes.createdAt, since));
  }

  if (payload.cursor) {
    const cursorDate = new Date(payload.cursor);
    filters.push(lt(notes.createdAt, cursorDate));
  }

  let query = db.select().from(notes);

  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  const limit = payload.limit ?? 50;
  const items = await query.orderBy(desc(notes.createdAt)).limit(limit);

  const nextCursor = items.length === limit ? items[items.length - 1]?.createdAt?.toISOString() : null;

  return c.json({
    notes: items,
    nextCursor,
  });
});

export default notesRoutes;
