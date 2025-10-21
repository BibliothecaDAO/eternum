import "dotenv/config";

import { randomUUID } from "crypto";
import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
  DirectMessageSendMessage,
  DirectReadMessage,
  DirectTypingMessage,
  WorldBroadcastMessage,
  WorldChatMessage,
  WorldPublishMessage,
  worldChatPublishSchema,
} from "@bibliothecadao/types";
import { db } from "./db/client";
import { worldChatMessages, type WorldChatMessageRecord } from "./db/schema/world-chat";
import { attachPlayerSession, requirePlayerSession, type AppEnv, type PlayerSession } from "./http/middleware/auth";
import directMessageRoutes from "./http/routes/direct-messages";
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

const addPlayerSocket = (playerId: string, ws: ServerWebSocket<unknown>) => {
  let sockets = playerSockets.get(playerId);
  if (!sockets) {
    sockets = new Set();
    playerSockets.set(playerId, sockets);
  }
  sockets.add(ws);
};

const removePlayerSocket = (playerId: string, ws: ServerWebSocket<unknown>) => {
  const sockets = playerSockets.get(playerId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) {
    playerSockets.delete(playerId);
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

const broadcastToZone = (
  zoneId: string,
  payload: WorldBroadcastMessage,
  sender?: ServerWebSocket<unknown>,
) => {
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
        addPlayerSocket(session.playerId, ws);
        ws.send(
          JSON.stringify({
            type: "connected",
            playerId: session.playerId,
          }),
        );
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
              }
              break;
            case "world:publish":
              await handleWorldPublish(ws, message, session);
              break;
            case "direct:message":
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
        removePlayerSocket(session.playerId, ws);
      },
      onError(_event, ws) {
        zoneRegistry.removeSocketFromAllZones(ws);
        removePlayerSocket(session.playerId, ws);
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
