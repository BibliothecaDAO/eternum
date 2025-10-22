import "dotenv/config";

import type { ServerWebSocket } from "bun";
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
  DirectMessage,
  directMessageCreateSchema,
  DirectMessageSendMessage,
  DirectMessageThread,
  DirectReadMessage,
  DirectTypingMessage,
  PlayerPresencePayload,
  WorldBroadcastMessage,
  WorldChatMessage,
  worldChatPublishSchema,
  WorldPublishMessage,
} from "@bibliothecadao/types";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import {
  directMessages,
  directMessageThreads,
  type DirectMessageRecord,
  type DirectMessageThreadRecord,
} from "./db/schema/direct-messages";
import { worldChatMessages, type WorldChatMessageRecord } from "./db/schema/world-chat";
import { attachPlayerSession, requirePlayerSession, type AppEnv, type PlayerSession } from "./http/middleware/auth";
import directMessageRoutes, { buildThreadId, sortParticipants } from "./http/routes/direct-messages";
import notesRoutes from "./http/routes/notes";
import worldChatRoutes from "./http/routes/world-chat";
import { createZoneRegistry } from "./ws/zone-registry";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono<AppEnv>();

const rawCorsOrigin = process.env.CORS_ORIGIN ?? "*";
const corsOrigin =
  rawCorsOrigin === "*"
    ? "*"
    : rawCorsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

const zoneRegistry = createZoneRegistry();
const playerSockets = new Map<string, Set<ServerWebSocket<unknown>>>();
const playerSessions = new Map<string, PlayerSession>();
const playerPresence = new Map<string, PlayerPresencePayload>();

const addPlayerSocket = (playerId: string, ws: ServerWebSocket<unknown>) => {
  let sockets = playerSockets.get(playerId);
  const wasEmpty = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set();
    playerSockets.set(playerId, sockets);
  }
  sockets.add(ws);
  return wasEmpty;
};

const removePlayerSocket = (playerId: string, ws: ServerWebSocket<unknown>) => {
  const sockets = playerSockets.get(playerId);
  if (!sockets) return true;
  sockets.delete(ws);
  if (sockets.size === 0) {
    playerSockets.delete(playerId);
    return true;
  }
  return false;
};

const getPresenceSnapshot = (): PlayerPresencePayload[] =>
  Array.from(playerPresence.values()).map((presence) => ({
    ...presence,
    isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
  }));

const upsertPresence = (playerId: string, updates: Partial<PlayerPresencePayload>): PlayerPresencePayload => {
  const session = playerSessions.get(playerId);
  const existing = playerPresence.get(playerId);

  const base: PlayerPresencePayload = existing ?? {
    playerId,
    displayName: session?.displayName ?? null,
    walletAddress: session?.walletAddress ?? null,
    lastSeenAt: null,
    isOnline: false,
    isTypingInThreadIds: [],
    lastZoneId: null,
  };

  const next: PlayerPresencePayload = {
    ...base,
    displayName: updates.displayName ?? base.displayName ?? session?.displayName ?? null,
    walletAddress: updates.walletAddress ?? base.walletAddress ?? session?.walletAddress ?? null,
    lastSeenAt: updates.lastSeenAt ?? base.lastSeenAt ?? null,
    isOnline: updates.isOnline ?? base.isOnline,
    lastZoneId: updates.lastZoneId ?? base.lastZoneId ?? null,
    isTypingInThreadIds: updates.isTypingInThreadIds ?? base.isTypingInThreadIds ?? [],
  };

  playerPresence.set(playerId, next);
  return next;
};

const broadcastToAllPlayers = (payload: unknown, exclude?: ServerWebSocket<unknown>) => {
  const serialized = JSON.stringify(payload);
  for (const sockets of playerSockets.values()) {
    for (const socket of sockets) {
      if (exclude && socket === exclude) {
        continue;
      }
      try {
        socket.send(serialized);
      } catch (error) {
        console.error("Failed to deliver broadcast", error);
      }
    }
  }
};

const broadcastPresenceUpdate = (playerId: string, exclude?: ServerWebSocket<unknown>) => {
  const presence = playerPresence.get(playerId);
  if (!presence) return;
  broadcastToAllPlayers(
    {
      type: "presence:update",
      player: {
        ...presence,
        isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
      },
    },
    exclude,
  );
};

const sendPresenceSnapshot = (ws: ServerWebSocket<unknown>) => {
  try {
    ws.send(
      JSON.stringify({
        type: "presence:sync",
        players: getPresenceSnapshot(),
      }),
    );
  } catch (error) {
    console.error("Failed to send presence snapshot", error);
  }
};

const sendError = (ws: ServerWebSocket<unknown>, code: string, message: string) => {
  try {
    ws.send(
      JSON.stringify({
        type: "error",
        code,
        message,
      }),
    );
  } catch (error) {
    console.error("Failed to send error payload", error);
  }
};

const toWorldChatMessage = (
  record: WorldChatMessageRecord,
  zoneId: string,
  session: PlayerSession,
): WorldChatMessage => ({
  id: record.id,
  zoneId,
  content: record.content,
  createdAt: (record.createdAt ?? new Date()).toISOString(),
  location: record.location ?? undefined,
  metadata: record.metadata ?? undefined,
  sender: {
    playerId: session.playerId,
    walletAddress: session.walletAddress ?? undefined,
    displayName: session.displayName ?? undefined,
    avatarUrl: undefined,
  },
});

const toDirectMessage = (record: DirectMessageRecord): DirectMessage => ({
  id: record.id,
  threadId: record.threadId,
  senderId: record.senderId,
  recipientId: record.recipientId,
  content: record.content,
  metadata: record.metadata ?? undefined,
  createdAt: (record.createdAt ?? new Date()).toISOString(),
});

const toDirectMessageThread = (
  record: DirectMessageThreadRecord,
  participants: [string, string],
): DirectMessageThread => ({
  id: record.id,
  participants,
  createdAt: (record.createdAt ?? new Date()).toISOString(),
  updatedAt: record.updatedAt ? record.updatedAt.toISOString() : undefined,
  lastMessageId: record.lastMessageId ?? undefined,
  unreadCounts: record.unreadCounts ?? {},
  typing: [],
});

const broadcastToZone = (zoneId: string, payload: WorldBroadcastMessage, sender?: ServerWebSocket<unknown>) => {
  const serialized = JSON.stringify(payload);
  let sentToSender = false;

  for (const socket of zoneRegistry.getSocketsForZone(zoneId)) {
    try {
      socket.send(serialized);
      if (sender && socket === sender) {
        sentToSender = true;
      }
    } catch (error) {
      console.error("Failed to deliver world broadcast", error);
    }
  }

  if (sender && !sentToSender) {
    try {
      sender.send(serialized);
    } catch (error) {
      console.error("Failed to deliver world broadcast to sender", error);
    }
  }
};

const sendToPlayer = (playerId: string, payload: unknown): boolean => {
  const sockets = playerSockets.get(playerId);
  if (!sockets || sockets.size === 0) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    try {
      socket.send(serialized);
    } catch (error) {
      console.error(`Failed to deliver payload to player ${playerId}`, error);
    }
  }

  return true;
};

const broadcastDirectMessage = (
  participants: [string, string],
  payload: { type: "direct:message"; message: DirectMessage; thread: DirectMessageThread; clientMessageId?: string },
) => {
  const delivered = new Set<string>();
  const tryDeliver = (playerId: string) => {
    if (delivered.has(playerId)) {
      return;
    }
    if (sendToPlayer(playerId, payload)) {
      delivered.add(playerId);
    }
  };

  const targets = new Set(participants);
  for (const participant of targets) {
    tryDeliver(participant);
    for (const [activePlayerId, session] of playerSessions.entries()) {
      if (delivered.has(activePlayerId)) {
        continue;
      }
      if (session.aliases.includes(participant)) {
        tryDeliver(activePlayerId);
      }
    }
  }
};

const handleWorldPublish = async (
  ws: ServerWebSocket<unknown>,
  message: WorldPublishMessage,
  session: PlayerSession,
) => {
  const payloadResult = worldChatPublishSchema.safeParse(message.payload);
  if (!payloadResult.success) {
    const firstError = payloadResult.error.errors[0]?.message ?? "Invalid world chat payload.";
    sendError(ws, "invalid_world_payload", firstError);
    return;
  }

  const payload = payloadResult.data;
  const zoneId = payload.zoneId ?? message.zoneId;

  try {
    const [created] = await db
      .insert(worldChatMessages)
      .values({
        id: randomUUID(),
        zoneId,
        senderId: session.playerId,
        senderWallet: session.walletAddress ?? null,
        senderDisplayName: session.displayName ?? null,
        content: payload.content,
        location: payload.location ?? null,
        metadata: payload.metadata ?? null,
      })
      .returning();

    if (!created) {
      throw new Error("World chat insert returned no record");
    }

    const broadcastPayload: WorldBroadcastMessage = {
      type: "world:message",
      zoneId,
      clientMessageId: message.clientMessageId,
      message: toWorldChatMessage(created, zoneId, session),
    };

    broadcastToZone(zoneId, broadcastPayload, ws);
  } catch (error) {
    console.error("Failed to persist world chat message", error);
    sendError(ws, "world_publish_failed", "Unable to publish message right now.");
  }
};

const handleDirectMessage = async (
  ws: ServerWebSocket<unknown>,
  message: DirectMessageSendMessage,
  session: PlayerSession,
) => {
  const payloadResult = directMessageCreateSchema.safeParse(message.payload);
  if (!payloadResult.success) {
    const firstError = payloadResult.error.errors[0]?.message ?? "Invalid direct message payload.";
    sendError(ws, "invalid_direct_payload", firstError);
    return;
  }

  const payload = payloadResult.data;

  const aliases = session.aliases ?? [session.playerId];

  if (aliases.includes(payload.recipientId)) {
    sendError(ws, "direct_self_message", "Cannot send a message to yourself.");
    return;
  }

  const expectedThreadId = buildThreadId(session.playerId, payload.recipientId);
  const providedThreadId = payload.threadId ?? expectedThreadId;

  try {
    let [thread] = await db
      .select()
      .from(directMessageThreads)
      .where(eq(directMessageThreads.id, providedThreadId))
      .limit(1);

    if (!thread && providedThreadId !== expectedThreadId) {
      sendError(ws, "direct_thread_mismatch", "Thread id does not match participants.");
      return;
    }

    let recipientId = payload.recipientId;

    if (thread) {
      const participants = [thread.playerAId, thread.playerBId];
      const participantSet = new Set(participants);
      const playerMatches = aliases.some((alias) => participantSet.has(alias));

      if (!playerMatches) {
        sendError(ws, "direct_access_denied", "You are not a participant in this thread.");
        return;
      }

      if (!participantSet.has(recipientId)) {
        const otherParticipant = participants.find((participant) => !aliases.includes(participant));
        if (!otherParticipant) {
          sendError(ws, "direct_recipient_unknown", "Unable to determine thread recipient.");
          return;
        }
        recipientId = otherParticipant;
      }

      if (aliases.includes(recipientId)) {
        sendError(ws, "direct_self_message", "Cannot send a message to yourself.");
        return;
      }
    } else {
      const participants = sortParticipants(session.playerId, recipientId);
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

      if (aliases.includes(recipientId)) {
        sendError(ws, "direct_self_message", "Cannot send a message to yourself.");
        return;
      }
    }

    if (!thread) {
      throw new Error("Failed to resolve direct message thread");
    }

    const messageId = randomUUID();
    const [createdMessage] = await db
      .insert(directMessages)
      .values({
        id: messageId,
        threadId: thread.id,
        senderId: session.playerId,
        recipientId,
        content: payload.content,
        metadata: payload.metadata ?? null,
      })
      .returning();

    if (!createdMessage) {
      throw new Error("Direct message insert returned no record");
    }

    const createdAt =
      createdMessage.createdAt instanceof Date
        ? createdMessage.createdAt
        : createdMessage.createdAt
          ? new Date(createdMessage.createdAt)
          : new Date();

    const unreadCounts = {
      ...(thread.unreadCounts ?? {}),
      [recipientId]: (thread.unreadCounts?.[recipientId] ?? 0) + 1,
    };

    await db
      .update(directMessageThreads)
      .set({
        unreadCounts,
        lastMessageId: messageId,
        lastMessageAt: createdAt,
        updatedAt: createdAt,
      })
      .where(eq(directMessageThreads.id, thread.id));

    const [updatedThread] = await db
      .select()
      .from(directMessageThreads)
      .where(eq(directMessageThreads.id, thread.id))
      .limit(1);

    if (!updatedThread) {
      throw new Error("Failed to load updated thread");
    }

    const threadParticipants = sortParticipants(updatedThread.playerAId, updatedThread.playerBId) as [string, string];

    broadcastDirectMessage(threadParticipants, {
      type: "direct:message",
      message: toDirectMessage(createdMessage),
      thread: toDirectMessageThread(updatedThread, threadParticipants),
      clientMessageId: message.clientMessageId,
    });
  } catch (error) {
    console.error("Failed to process direct message", error);
    sendError(ws, "direct_message_failed", "Unable to deliver message right now.");
  }
};

app.use("*", logger());
app.use("*", attachPlayerSession);
app.use(
  "/api/*",
  cors({
    origin: corsOrigin,
    allowHeaders: ["Content-Type", "x-player-id", "x-wallet-address", "x-player-name"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(
  "/health",
  cors({
    origin: corsOrigin,
    allowHeaders: ["*"],
    allowMethods: ["GET"],
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/notes", notesRoutes);
app.route("/api/chat/world", worldChatRoutes);
app.route("/api/chat/dm", directMessageRoutes);

type ClientMessage =
  | { type: "join:zone"; zoneId: string }
  | { type: "leave:zone"; zoneId: string }
  | WorldPublishMessage
  | DirectMessageSendMessage
  | DirectTypingMessage
  | DirectReadMessage;

app.get(
  "/ws",
  requirePlayerSession,
  upgradeWebSocket((c) => {
    const session = c.get("playerSession");

    if (!session) {
      throw new Error("Player session missing for websocket connection");
    }

    return {
      onOpen(_event, ws) {
        const isFirstConnection = addPlayerSocket(session.playerId, ws);
        playerSessions.set(session.playerId, session);
        upsertPresence(session.playerId, {
          isOnline: true,
          lastSeenAt: null,
          displayName: session.displayName ?? null,
          walletAddress: session.walletAddress ?? null,
        });
        ws.send(
          JSON.stringify({
            type: "connected",
            playerId: session.playerId,
          }),
        );
        sendPresenceSnapshot(ws);
        if (isFirstConnection) {
          broadcastPresenceUpdate(session.playerId, ws);
        } else {
          broadcastPresenceUpdate(session.playerId);
        }
      },
      async onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString()) as ClientMessage;

          switch (message.type) {
            case "join:zone":
              if (message.zoneId) {
                zoneRegistry.addSocketToZone(ws, message.zoneId);
                ws.send(
                  JSON.stringify({
                    type: "joined:zone",
                    zoneId: message.zoneId,
                  }),
                );
                upsertPresence(session.playerId, { lastZoneId: message.zoneId });
                broadcastPresenceUpdate(session.playerId);
              }
              break;
            case "leave:zone":
              if (message.zoneId) {
                zoneRegistry.removeSocketFromZone(ws, message.zoneId);
                ws.send(
                  JSON.stringify({
                    type: "left:zone",
                    zoneId: message.zoneId,
                  }),
                );
                upsertPresence(session.playerId, { lastZoneId: null });
                broadcastPresenceUpdate(session.playerId);
              }
              break;
            case "world:publish":
              await handleWorldPublish(ws, message, session);
              break;
            case "direct:message":
              await handleDirectMessage(ws, message, session);
              break;
            case "direct:typing":
            case "direct:read":
              console.warn(`Unhandled realtime message type: ${message.type}`);
              break;
            default:
              console.warn("Unknown realtime message", message);
          }
        } catch (error) {
          console.error("Failed to process websocket message", error);
          sendError(ws, "invalid_message", "Malformed realtime payload.");
        }
      },
      onClose(_event, ws) {
        zoneRegistry.removeSocketFromAllZones(ws);
        const lastSocket = removePlayerSocket(session.playerId, ws);
        if (lastSocket) {
          upsertPresence(session.playerId, {
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            isTypingInThreadIds: [],
            lastZoneId: null,
          });
          broadcastPresenceUpdate(session.playerId);
          playerSessions.delete(session.playerId);
        }
      },
      onError(_event, ws) {
        zoneRegistry.removeSocketFromAllZones(ws);
        const lastSocket = removePlayerSocket(session.playerId, ws);
        if (lastSocket) {
          upsertPresence(session.playerId, {
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            isTypingInThreadIds: [],
            lastZoneId: null,
          });
          broadcastPresenceUpdate(session.playerId);
          playerSessions.delete(session.playerId);
        }
      },
    };
  }),
);

const port = Number(process.env.PORT ?? 4001);

Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`Realtime server listening on port ${port}`);

export default app;
