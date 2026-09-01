import "dotenv/config";

import type { ServerWebSocket } from "bun";
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { Effect, Result } from "effect";
import { upgradeWebSocket, websocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
  type DirectMessage,
  directMessageCreateSchema,
  type DirectMessageSendMessage,
  type DirectMessageThread,
  type PlayerPresencePayload,
  type WorldBroadcastMessage,
  type WorldChatMessage,
  worldChatPublishSchema,
  type WorldPublishMessage,
  zoneIdSchema,
} from "@bibliothecadao/types";
import type { DirectMessageRecord, DirectMessageThreadRecord } from "./db/schema/direct-messages";
import { worldChatMessages, type WorldChatMessageRecord } from "./db/schema/world-chat";
import { parseGameChannel } from "./channels/channel";
import type { MembershipResolver } from "./channels/membership";
import { isAllowedOrigin, readSecurityConfig, type SecurityConfig } from "./config/security";
import {
  createAttachPlayerSession,
  requirePlayerSession,
  type AppEnv,
  type PlayerSession,
  type SessionResolver,
} from "./http/middleware/auth";
import directMessageRoutes from "./http/routes/direct-messages";
import { createNotesRoutes } from "./http/routes/notes";
import { createWorldChatRoutes } from "./http/routes/world-chat";
import { DirectMessageError, persistDirectMessage, sortParticipants } from "./services/direct-messages";
import { startChatRetention } from "./services/retention";
import { databaseEffect } from "./effect/database";
import { fanOut } from "./effect/fan-out";
import { createRealtimeDependencies } from "./effect/runtime";
import { createConnectionGuard, frameByteLength } from "./ws/connection-guard";
import { createPresenceRegistry } from "./ws/presence-registry";
import { createZoneRegistry } from "./ws/zone-registry";

type Socket = ServerWebSocket<unknown>;
type ClientMessage =
  | { type: "join:zone"; zoneId: string }
  | { type: "leave:zone"; zoneId: string }
  | WorldPublishMessage
  | DirectMessageSendMessage;

interface RealtimeDependencies {
  membership: MembershipResolver;
  sessions: SessionResolver;
  security: SecurityConfig;
}

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const send = (socket: Socket, payload: unknown) => {
  try {
    socket.send(JSON.stringify(payload));
  } catch (error) {
    console.error("realtime_delivery_failed", error);
  }
};

const sendError = (socket: Socket, code: string, message: string) => send(socket, { type: "error", code, message });

const toWorldChatMessage = (record: WorldChatMessageRecord, session: PlayerSession): WorldChatMessage => ({
  id: record.id,
  zoneId: record.zoneId!,
  content: record.content,
  createdAt: (record.createdAt ?? new Date()).toISOString(),
  location: record.location ?? undefined,
  metadata: record.metadata ?? undefined,
  sender: { playerId: session.playerId, displayName: session.displayName },
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

const toDirectThread = (record: DirectMessageThreadRecord, participants: [string, string]): DirectMessageThread => ({
  id: record.id,
  participants,
  createdAt: (record.createdAt ?? new Date()).toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
  lastMessageId: record.lastMessageId ?? undefined,
  unreadCounts: record.unreadCounts ?? {},
  typing: [],
});

export const createRealtimeApp = ({ membership, sessions, security }: RealtimeDependencies) => {
  const app = new Hono<AppEnv>();
  const channels = createZoneRegistry();
  const presence = createPresenceRegistry<Socket>();
  const sessionBySocket = new WeakMap<Socket, PlayerSession>();
  const acceptedSockets = new WeakSet<Socket>();
  const guard = createConnectionGuard({
    globalCap: security.globalConnectionCap,
    perPlayerCap: security.perPlayerConnectionCap,
    messagesPerSecond: security.messagesPerSecond,
    messageBurst: security.messageBurst,
  });

  const socketsSharingChannels = (socket: Socket): Set<Socket> => {
    const recipients = new Set<Socket>();
    for (const channelId of channels.getZonesForSocket(socket)) {
      for (const recipient of channels.getSocketsForZone(channelId)) recipients.add(recipient);
    }
    return recipients;
  };

  const playerIdsSharingChannels = (socket: Socket): Set<string> => {
    const playerIds = new Set<string>();
    for (const recipient of socketsSharingChannels(socket)) {
      const session = sessionBySocket.get(recipient);
      if (session) playerIds.add(session.playerId);
    }
    return playerIds;
  };

  const broadcastPresence = (socket: Socket, player: PlayerPresencePayload) => {
    void Effect.runPromise(
      fanOut(socketsSharingChannels(socket), (recipient) => send(recipient, { type: "presence:update", player })),
    );
  };

  const broadcastPresenceRemoval = (recipients: ReadonlySet<Socket>, playerId: string) => {
    void Effect.runPromise(fanOut(recipients, (recipient) => send(recipient, { type: "presence:remove", playerId })));
  };

  const handleJoin = async (socket: Socket, session: PlayerSession, value: unknown) => {
    const parsed = zoneIdSchema.safeParse(value);
    if (!parsed.success || !parseGameChannel(parsed.data)) {
      sendError(socket, "invalid_channel", "Expected a game:<positive-id> channel.");
      return;
    }
    if (channels.getZonesForSocket(socket).size >= security.maxChannelsPerSocket) {
      sendError(socket, "channel_cap", "This connection has joined too many channels.");
      return;
    }
    if (
      !session.membershipPlayerId ||
      !(await Effect.runPromise(membership.isMember(session.membershipPlayerId, parsed.data)))
    ) {
      sendError(socket, "channel_access_denied", "Channel membership required.");
      return;
    }
    channels.addSocketToZone(socket, parsed.data);
    send(socket, { type: "joined:zone", zoneId: parsed.data });
    send(socket, { type: "presence:sync", players: presence.snapshot(playerIdsSharingChannels(socket)) });
    const ownPresence = presence.get(session.playerId);
    if (ownPresence) broadcastPresence(socket, ownPresence);
  };

  const handleWorldPublish = async (socket: Socket, session: PlayerSession, message: WorldPublishMessage) => {
    const result = worldChatPublishSchema.safeParse(message.payload);
    if (!result.success) {
      sendError(socket, "invalid_world_payload", result.error.issues[0]?.message ?? "Invalid chat payload.");
      return;
    }
    const channelId = result.data.zoneId;
    if (message.zoneId !== channelId || !parseGameChannel(channelId)) {
      sendError(socket, "invalid_channel", "Message channel does not match its payload.");
      return;
    }
    if (!channels.getZonesForSocket(socket).has(channelId)) {
      sendError(socket, "channel_not_joined", "Join the channel before publishing.");
      return;
    }
    if (
      !session.membershipPlayerId ||
      !(await Effect.runPromise(membership.isMember(session.membershipPlayerId, channelId)))
    ) {
      sendError(socket, "channel_access_denied", "Channel membership required.");
      return;
    }

    const [created] = await Effect.runPromise(
      databaseEffect("publish websocket game chat message", (database) =>
        database
          .insert(worldChatMessages)
          .values({
            id: randomUUID(),
            zoneId: channelId,
            senderId: session.playerId,
            senderDisplayName: session.displayName ?? null,
            content: result.data.content,
            location: result.data.location ?? null,
            metadata: result.data.metadata ?? null,
          })
          .returning(),
      ),
    );
    if (!created) throw new Error("World chat insert returned no record");

    const payload: WorldBroadcastMessage = {
      type: "world:message",
      zoneId: channelId,
      clientMessageId: message.clientMessageId,
      message: toWorldChatMessage(created, session),
    };
    await Effect.runPromise(fanOut(channels.getSocketsForZone(channelId), (recipient) => send(recipient, payload)));
  };

  const handleDirectMessage = async (socket: Socket, session: PlayerSession, message: DirectMessageSendMessage) => {
    const result = directMessageCreateSchema.safeParse(message.payload);
    if (!result.success) {
      sendError(socket, "invalid_direct_payload", result.error.issues[0]?.message ?? "Invalid direct message.");
      return;
    }
    const persisted = await Effect.runPromise(Effect.result(persistDirectMessage(session, result.data)));
    if (Result.isFailure(persisted)) {
      if (persisted.failure instanceof DirectMessageError) {
        sendError(socket, persisted.failure.code, persisted.failure.message);
        return;
      }
      throw persisted.failure;
    }
    const payload = {
      type: "direct:message",
      message: toDirectMessage(persisted.success.message),
      thread: toDirectThread(persisted.success.thread, sortParticipants(...persisted.success.participants)),
      clientMessageId: message.clientMessageId,
    };
    const recipients = new Set(
      persisted.success.participants.flatMap((participant) => Array.from(presence.socketsFor(participant))),
    );
    await Effect.runPromise(fanOut(recipients, (recipient) => send(recipient, payload)));
  };

  const disconnect = (socket: Socket, session: PlayerSession) => {
    if (!acceptedSockets.has(socket)) return;
    acceptedSockets.delete(socket);
    const recipients = socketsSharingChannels(socket);
    recipients.delete(socket);
    channels.removeSocketFromAllZones(socket);
    guard.disconnected(session.playerId);
    guard.forget(socket);
    if (presence.disconnect(session.playerId, socket)) broadcastPresenceRemoval(recipients, session.playerId);
  };

  app.use("*", logger());
  app.use("/api/*", createAttachPlayerSession(sessions));
  app.use("/ws", createAttachPlayerSession(sessions));
  app.use(
    "/api/*",
    cors({
      origin: Array.from(security.allowedOrigins),
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.route("/api/notes", createNotesRoutes(membership));
  app.route("/api/chat/world", createWorldChatRoutes(membership));
  app.route("/api/chat/dm", directMessageRoutes);

  app.use("/ws", requirePlayerSession);
  app.use("/ws", async (c, next) => {
    if (!isAllowedOrigin(c.req.header("origin"), security.allowedOrigins)) {
      return c.json({ error: "WebSocket origin is not allowed." }, 403);
    }
    await next();
  });

  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const session = c.get("playerSession")!;
      return {
        async onOpen(_event, context: WSContext) {
          const socket = context.raw as Socket;
          if (!guard.canConnect(session.playerId)) {
            context.close(1008, "Connection limit exceeded");
            return;
          }
          guard.connected(session.playerId);
          acceptedSockets.add(socket);
          sessionBySocket.set(socket, session);
          presence.connect(session, socket);
          try {
            const memberships = session.membershipPlayerId
              ? Array.from(await Effect.runPromise(membership.channelsForPlayer(session.membershipPlayerId)))
              : [];
            const joinedChannels = memberships.slice(0, security.maxChannelsPerSocket);
            for (const channelId of joinedChannels) channels.addSocketToZone(socket, channelId);
            send(socket, {
              type: "connected",
              playerId: session.playerId,
              displayName: session.displayName ?? null,
              channels: joinedChannels,
            });
            send(socket, { type: "presence:sync", players: presence.snapshot(playerIdsSharingChannels(socket)) });
            const ownPresence = presence.get(session.playerId);
            if (ownPresence) broadcastPresence(socket, ownPresence);
          } catch (error) {
            console.error("realtime_membership_bootstrap_failed", error);
            context.close(1011, "Membership lookup failed");
          }
        },
        async onMessage(event, context: WSContext) {
          const socket = context.raw as Socket;
          if (frameByteLength(event.data) > security.maxMessageBytes) {
            sendError(socket, "message_too_large", "Realtime message exceeds the size limit.");
            return;
          }
          if (!guard.consume(socket)) {
            sendError(socket, "rate_limited", "Realtime message rate exceeded.");
            return;
          }
          try {
            const message = JSON.parse(event.data.toString()) as ClientMessage;
            switch (message.type) {
              case "join:zone":
                await handleJoin(socket, session, message.zoneId);
                break;
              case "leave:zone":
                channels.removeSocketFromZone(socket, message.zoneId);
                send(socket, { type: "left:zone", zoneId: message.zoneId });
                break;
              case "world:publish":
                await handleWorldPublish(socket, session, message);
                break;
              case "direct:message":
                await handleDirectMessage(socket, session, message);
                break;
              default:
                sendError(socket, "invalid_message", "Unknown realtime message type.");
            }
          } catch (error) {
            console.error("realtime_message_failed", error);
            sendError(socket, "invalid_message", "Malformed realtime payload.");
          }
        },
        onClose(_event, context: WSContext) {
          disconnect(context.raw as Socket, session);
        },
        onError(_event, context: WSContext) {
          disconnect(context.raw as Socket, session);
        },
      };
    }),
  );

  return app;
};

const port = Number(process.env.PORT ?? 8080);
const security = readSecurityConfig();
const app = createRealtimeApp({
  ...createRealtimeDependencies({
    identityUrl: requiredEnvironment("IDENTITY_URL"),
    heraldUrl: requiredEnvironment("HERALD_URL"),
    heraldChain: process.env.HERALD_CHAIN ?? "madara",
    gameRpcUrl: requiredEnvironment("GAME_RPC_URL"),
    playerRegistryAddress: requiredEnvironment("PLAYER_REGISTRY_ADDRESS"),
  }),
  security,
});
startChatRetention();

console.log("Starting realtime server", {
  port,
  databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
  identityUrl: process.env.IDENTITY_URL,
  heraldUrl: process.env.HERALD_URL,
  allowedOrigins: Array.from(security.allowedOrigins),
});

const serverConfig = { port, hostname: "0.0.0.0", fetch: app.fetch, websocket };

export { app };
export default serverConfig;
