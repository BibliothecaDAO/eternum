import { DurableObject } from "cloudflare:workers";
import {
  worldChatPublishSchema,
  type PlayerPresencePayload,
  type WorldChatMessage,
  type WorldPublishMessage,
} from "@bibliothecadao/types";

import { chatMemberOf, consumeChatBudget, readChatFrame, sendChat, type ChatMember } from "./chat-sockets";

/** A room keeps thirty days of messages, and never more than its last five hundred. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 500;

interface MessageRow extends Record<string, SqlStorageValue> {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  location: string | null;
  metadata: string | null;
  createdAt: number;
}

/**
 * One chat room: its members' sockets and its history. Sockets use the hibernation API only, with no timer or
 * interval, so a room with no traffic is evicted from memory and costs nothing until the next message wakes it.
 */
export class ChatRoom extends DurableObject<Record<string, unknown>> {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, senderId TEXT NOT NULL, senderName TEXT, content TEXT NOT NULL,
         location TEXT, metadata TEXT, createdAt INTEGER NOT NULL);
       CREATE INDEX IF NOT EXISTS messages_created ON messages (createdAt)`,
    );
  }

  /** A member's socket, already authenticated and admitted by the Worker, which names the member and the room. */
  override async fetch(request: Request): Promise<Response> {
    const member = chatMemberOf(request);
    const room = request.headers.get("x-chat-room");
    if (!member || !room) return new Response("chat member required", { status: 400 });
    await this.ctx.storage.put("room", room);
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [member.realmsId]);
    server.serializeAttachment(member);
    sendChat(server, { type: "joined:zone", zoneId: room });
    sendChat(server, { type: "presence:sync", players: this.presence() });
    this.broadcast({ type: "presence:update", player: presenceOf(member) }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const member = socket.deserializeAttachment() as ChatMember;
    const frame = readChatFrame(socket, data);
    if (!frame || !consumeChatBudget(socket)) return;
    if (frame.type !== "world:publish") {
      sendChat(socket, { type: "error", code: "invalid_message", message: "Rooms take world:publish only." });
      return;
    }
    await this.publish(socket, member, frame as WorldPublishMessage);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    this.leave(socket);
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    this.leave(socket);
  }

  /** The room's history, newest first, a page before the cursor (an ISO time). */
  async history(
    cursor: string | undefined,
    limit: number,
  ): Promise<{ messages: WorldChatMessage[]; nextCursor: string | null }> {
    const room = (await this.ctx.storage.get<string>("room")) ?? "";
    const before = cursor ? Date.parse(cursor) : Number.MAX_SAFE_INTEGER;
    const rows = this.ctx.storage.sql
      .exec<MessageRow>("SELECT * FROM messages WHERE createdAt < ? ORDER BY createdAt DESC LIMIT ?", before, limit)
      .toArray();
    const messages = rows.map((row) => toWorldChatMessage(room, row));
    return { messages, nextCursor: rows.length === limit ? (messages.at(-1)?.createdAt as string) : null };
  }

  private async publish(socket: WebSocket, member: ChatMember, message: WorldPublishMessage) {
    const room = await this.ctx.storage.get<string>("room");
    const parsed = worldChatPublishSchema.safeParse(message.payload);
    if (!parsed.success || message.zoneId !== room || parsed.data.zoneId !== room) {
      sendChat(socket, { type: "error", code: "invalid_world_payload", message: "Invalid message for this room." });
      return;
    }
    const row: MessageRow = {
      id: crypto.randomUUID(),
      senderId: member.realmsId,
      senderName: member.displayName ?? null,
      content: parsed.data.content,
      location: parsed.data.location ? JSON.stringify(parsed.data.location) : null,
      metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
      createdAt: Date.now(),
    };
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (id, senderId, senderName, content, location, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ...Object.values(row),
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM messages WHERE createdAt < ? OR id NOT IN (SELECT id FROM messages ORDER BY createdAt DESC LIMIT ?)",
      row.createdAt - RETENTION_MS,
      HISTORY_LIMIT,
    );
    this.broadcast({
      type: "world:message",
      zoneId: room,
      clientMessageId: message.clientMessageId,
      message: toWorldChatMessage(room, row),
    });
  }

  private leave(socket: WebSocket) {
    const member = socket.deserializeAttachment() as ChatMember | null;
    if (!member) return;
    const stillHere = this.ctx.getWebSockets(member.realmsId).some((other) => other !== socket);
    if (!stillHere) this.broadcast({ type: "presence:remove", playerId: member.realmsId }, socket);
  }

  private presence(): PlayerPresencePayload[] {
    const members = new Map<string, ChatMember>();
    for (const socket of this.ctx.getWebSockets()) {
      const member = socket.deserializeAttachment() as ChatMember;
      members.set(member.realmsId, member);
    }
    return [...members.values()].map(presenceOf);
  }

  private broadcast(payload: unknown, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) if (socket !== except) sendChat(socket, payload);
  }
}

const presenceOf = (member: ChatMember): PlayerPresencePayload => ({
  playerId: member.realmsId,
  displayName: member.displayName ?? null,
  isOnline: true,
});

const toWorldChatMessage = (room: string, row: MessageRow): WorldChatMessage => ({
  id: row.id,
  zoneId: room,
  content: row.content,
  createdAt: new Date(row.createdAt).toISOString(),
  ...(row.location ? { location: JSON.parse(row.location) } : {}),
  ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
  sender: { playerId: row.senderId, ...(row.senderName ? { displayName: row.senderName } : {}) },
});
