import "dotenv/config";
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { directMessageCreateSchema, worldChatPublishSchema, } from "@bibliothecadao/types";
import { eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { directMessages, directMessageThreads, } from "./db/schema/direct-messages";
import { worldChatMessages } from "./db/schema/world-chat";
import { attachPlayerSession, requirePlayerSession } from "./http/middleware/auth";
import directMessageRoutes, { buildThreadId, sortParticipants } from "./http/routes/direct-messages";
import notesRoutes from "./http/routes/notes";
import worldChatRoutes from "./http/routes/world-chat";
import { createZoneRegistry } from "./ws/zone-registry";
const app = new Hono();
const rawCorsOrigin = process.env.CORS_ORIGIN ?? "*";
const corsOrigin = rawCorsOrigin === "*"
    ? "*"
    : rawCorsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
const zoneRegistry = createZoneRegistry();
const playerSockets = new Map();
const playerSessions = new Map();
const playerPresence = new Map();
const addPlayerSocket = (playerId, ws) => {
    let sockets = playerSockets.get(playerId);
    const wasEmpty = !sockets || sockets.size === 0;
    if (!sockets) {
        sockets = new Set();
        playerSockets.set(playerId, sockets);
    }
    sockets.add(ws);
    return wasEmpty;
};
const removePlayerSocket = (playerId, ws) => {
    const sockets = playerSockets.get(playerId);
    if (!sockets)
        return true;
    sockets.delete(ws);
    if (sockets.size === 0) {
        playerSockets.delete(playerId);
        return true;
    }
    return false;
};
const getPresenceSnapshot = () => Array.from(playerPresence.values()).map((presence) => ({
    ...presence,
    isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
}));
const upsertPresence = (playerId, updates) => {
    const session = playerSessions.get(playerId);
    const existing = playerPresence.get(playerId);
    const base = existing ?? {
        playerId,
        displayName: session?.displayName ?? null,
        walletAddress: session?.walletAddress ?? null,
        lastSeenAt: null,
        isOnline: false,
        isTypingInThreadIds: [],
        lastZoneId: null,
    };
    const next = {
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
const broadcastToAllPlayers = (payload, exclude) => {
    const serialized = JSON.stringify(payload);
    for (const sockets of playerSockets.values()) {
        for (const socket of sockets) {
            if (exclude && socket === exclude) {
                continue;
            }
            try {
                socket.send(serialized);
            }
            catch (error) {
                console.error("Failed to deliver broadcast", error);
            }
        }
    }
};
const broadcastPresenceUpdate = (playerId, exclude) => {
    const presence = playerPresence.get(playerId);
    if (!presence)
        return;
    broadcastToAllPlayers({
        type: "presence:update",
        player: {
            ...presence,
            isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
        },
    }, exclude);
};
const sendPresenceSnapshot = (ws) => {
    try {
        ws.send(JSON.stringify({
            type: "presence:sync",
            players: getPresenceSnapshot(),
        }));
    }
    catch (error) {
        console.error("Failed to send presence snapshot", error);
    }
};
const sendError = (ws, code, message) => {
    try {
        ws.send(JSON.stringify({
            type: "error",
            code,
            message,
        }));
    }
    catch (error) {
        console.error("Failed to send error payload", error);
    }
};
const toWorldChatMessage = (record, zoneId, session) => ({
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
const toDirectMessage = (record) => ({
    id: record.id,
    threadId: record.threadId,
    senderId: record.senderId,
    recipientId: record.recipientId,
    content: record.content,
    metadata: record.metadata ?? undefined,
    createdAt: (record.createdAt ?? new Date()).toISOString(),
});
const toDirectMessageThread = (record, participants) => ({
    id: record.id,
    participants,
    createdAt: (record.createdAt ?? new Date()).toISOString(),
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : undefined,
    lastMessageId: record.lastMessageId ?? undefined,
    unreadCounts: record.unreadCounts ?? {},
    typing: [],
});
const broadcastToZone = (zoneId, payload, sender) => {
    const serialized = JSON.stringify(payload);
    for (const socket of zoneRegistry.getSocketsForZone(zoneId)) {
        try {
            socket.send(serialized);
        }
        catch (error) {
            console.error("Failed to deliver world broadcast", error);
        }
    }
    // Always send to sender if provided (they might not be in the zone registry yet)
    if (sender) {
        try {
            sender.send(serialized);
        }
        catch (error) {
            console.error("Failed to deliver world broadcast to sender", error);
        }
    }
};
const sendToPlayer = (playerId, payload) => {
    const sockets = playerSockets.get(playerId);
    if (!sockets || sockets.size === 0) {
        return false;
    }
    const serialized = JSON.stringify(payload);
    for (const socket of sockets) {
        try {
            socket.send(serialized);
        }
        catch (error) {
            console.error(`Failed to deliver payload to player ${playerId}`, error);
        }
    }
    return true;
};
const broadcastDirectMessage = (participants, payload) => {
    const delivered = new Set();
    const tryDeliver = (playerId) => {
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
const handleWorldPublish = async (ws, message, session) => {
    const payloadResult = worldChatPublishSchema.safeParse(message.payload);
    if (!payloadResult.success) {
        const firstError = payloadResult.error.issues[0]?.message ?? "Invalid world chat payload.";
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
        const broadcastPayload = {
            type: "world:message",
            zoneId,
            clientMessageId: message.clientMessageId,
            message: toWorldChatMessage(created, zoneId, session),
        };
        broadcastToZone(zoneId, broadcastPayload, ws);
    }
    catch (error) {
        console.error("Failed to persist world chat message", error);
        sendError(ws, "world_publish_failed", "Unable to publish message right now.");
    }
};
const handleDirectMessage = async (ws, message, session) => {
    const payloadResult = directMessageCreateSchema.safeParse(message.payload);
    if (!payloadResult.success) {
        const firstError = payloadResult.error.issues[0]?.message ?? "Invalid direct message payload.";
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
    let error = null;
    let broadcastPayload = null;
    try {
        await db.transaction(async (tx) => {
            const loadThreadForUpdate = async () => {
                const result = await tx.execute(sql `select * from ${directMessageThreads} where ${directMessageThreads.id} = ${providedThreadId} for update`);
                return result.rows[0];
            };
            let recipientId = payload.recipientId;
            let thread = await loadThreadForUpdate();
            if (!thread && providedThreadId !== expectedThreadId) {
                error = { code: "direct_thread_mismatch", message: "Thread id does not match participants." };
                return;
            }
            if (!thread) {
                const participants = sortParticipants(session.playerId, recipientId);
                [thread] = await tx
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
                    thread = await loadThreadForUpdate();
                }
            }
            if (!thread) {
                throw new Error("Failed to resolve direct message thread");
            }
            const participants = [thread.playerAId, thread.playerBId];
            const participantSet = new Set(participants);
            const playerMatches = aliases.some((alias) => participantSet.has(alias));
            if (!playerMatches) {
                error = { code: "direct_access_denied", message: "You are not a participant in this thread." };
                return;
            }
            if (!participantSet.has(recipientId)) {
                const otherParticipant = participants.find((participant) => !aliases.includes(participant));
                if (!otherParticipant) {
                    error = { code: "direct_recipient_unknown", message: "Unable to determine thread recipient." };
                    return;
                }
                recipientId = otherParticipant;
            }
            if (aliases.includes(recipientId)) {
                error = { code: "direct_self_message", message: "Cannot send a message to yourself." };
                return;
            }
            const messageId = randomUUID();
            const [createdMessage] = await tx
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
            const createdAt = createdMessage.createdAt instanceof Date
                ? createdMessage.createdAt
                : createdMessage.createdAt
                    ? new Date(createdMessage.createdAt)
                    : new Date();
            const existingCounts = thread.unreadCounts ?? {};
            const unreadCounts = {
                ...existingCounts,
                [recipientId]: (existingCounts[recipientId] ?? 0) + 1,
            };
            const [updatedThread] = await tx
                .update(directMessageThreads)
                .set({
                unreadCounts,
                lastMessageId: messageId,
                lastMessageAt: createdAt,
                updatedAt: createdAt,
            })
                .where(eq(directMessageThreads.id, thread.id))
                .returning();
            if (!updatedThread) {
                throw new Error("Failed to load updated thread");
            }
            const threadParticipants = sortParticipants(updatedThread.playerAId, updatedThread.playerBId);
            broadcastPayload = {
                participants: threadParticipants,
                payload: {
                    type: "direct:message",
                    message: toDirectMessage(createdMessage),
                    thread: toDirectMessageThread(updatedThread, threadParticipants),
                    clientMessageId: message.clientMessageId,
                },
            };
        });
    }
    catch (error) {
        console.error("Failed to process direct message", error);
        sendError(ws, "direct_message_failed", "Unable to deliver message right now.");
        return;
    }
    if (error) {
        sendError(ws, error.code, error.message);
        return;
    }
    if (!broadcastPayload) {
        sendError(ws, "direct_message_failed", "Unable to deliver message right now.");
        return;
    }
    broadcastDirectMessage(broadcastPayload.participants, broadcastPayload.payload);
};
app.use("*", logger());
app.use("*", attachPlayerSession);
app.use("/api/*", cors({
    origin: corsOrigin,
    allowHeaders: ["Content-Type", "x-player-id", "x-wallet-address", "x-player-name"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
}));
app.use("/health", cors({
    origin: corsOrigin,
    allowHeaders: ["*"],
    allowMethods: ["GET"],
    credentials: true,
}));
app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/notes", notesRoutes);
app.route("/api/chat/world", worldChatRoutes);
app.route("/api/chat/dm", directMessageRoutes);
app.get("/ws", requirePlayerSession, upgradeWebSocket((c) => {
    const session = c.get("playerSession");
    if (!session) {
        throw new Error("Player session missing for websocket connection");
    }
    return {
        onOpen(_event, ws) {
            const isFirstConnection = addPlayerSocket(session.playerId, ws.raw);
            playerSessions.set(session.playerId, session);
            upsertPresence(session.playerId, {
                isOnline: true,
                lastSeenAt: null,
                displayName: session.displayName ?? null,
                walletAddress: session.walletAddress ?? null,
            });
            ws.send(JSON.stringify({
                type: "connected",
                playerId: session.playerId,
            }));
            sendPresenceSnapshot(ws.raw);
            if (isFirstConnection) {
                broadcastPresenceUpdate(session.playerId, ws.raw);
            }
            else {
                broadcastPresenceUpdate(session.playerId);
            }
        },
        async onMessage(event, ws) {
            const wsRaw = ws.raw;
            try {
                const message = JSON.parse(event.data.toString());
                switch (message.type) {
                    case "join:zone":
                        if (message.zoneId) {
                            zoneRegistry.addSocketToZone(wsRaw, message.zoneId);
                            ws.send(JSON.stringify({
                                type: "joined:zone",
                                zoneId: message.zoneId,
                            }));
                            upsertPresence(session.playerId, { lastZoneId: message.zoneId });
                            broadcastPresenceUpdate(session.playerId);
                        }
                        break;
                    case "leave:zone":
                        if (message.zoneId) {
                            zoneRegistry.removeSocketFromZone(wsRaw, message.zoneId);
                            ws.send(JSON.stringify({
                                type: "left:zone",
                                zoneId: message.zoneId,
                            }));
                            upsertPresence(session.playerId, { lastZoneId: null });
                            broadcastPresenceUpdate(session.playerId);
                        }
                        break;
                    case "world:publish":
                        await handleWorldPublish(wsRaw, message, session);
                        break;
                    case "direct:message":
                        await handleDirectMessage(wsRaw, message, session);
                        break;
                    case "direct:typing":
                    case "direct:read":
                        console.warn(`Unhandled realtime message type: ${message.type}`);
                        break;
                    default:
                        console.warn("Unknown realtime message", message);
                }
            }
            catch (error) {
                console.error("Failed to process websocket message", error);
                sendError(wsRaw, "invalid_message", "Malformed realtime payload.");
            }
        },
        onClose(_event, ws) {
            const wsRaw = ws.raw;
            zoneRegistry.removeSocketFromAllZones(wsRaw);
            const lastSocket = removePlayerSocket(session.playerId, wsRaw);
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
            const wsRaw = ws.raw;
            zoneRegistry.removeSocketFromAllZones(wsRaw);
            const lastSocket = removePlayerSocket(session.playerId, wsRaw);
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
}));
const port = Number(process.env.PORT ?? 4001);
Bun.serve({
    port,
    fetch: app.fetch,
    websocket,
});
console.log(`Realtime server listening on port ${port}`);
export default app;
//# sourceMappingURL=server.js.map