import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { DurableObject } from "cloudflare:workers";
import { Effect } from "effect";
import { buildDirectMessageNotification, includesKind } from "@bibliothecadao/notifications";
import {
  directMessageCreateSchema,
  directMessageReadReceiptSchema,
  directMessageTypingSchema,
  type BlockList,
  type DirectMessage,
  type DirectMessageReadReceipt,
  type DirectMessageThread,
  type DirectMessageTyping,
} from "@bibliothecadao/types";

import { decodeIdentityEnv, type IdentityEnv } from "../env";
import { NotificationPreferenceStore } from "../notification-preference-store";
import { PushSubscriptionStore } from "../push-subscription-store";
import { sendToDevice } from "../push-notifications";
import {
  chatInboxOf,
  chatMemberOf,
  chatRoomOf,
  consumeChatBudget,
  readChatFrame,
  sendChat,
  type ChatMember,
} from "./chat-sockets";
import { retentionCutoff, wakeAtNextExpiry } from "./retention";

interface ThreadRow extends Record<string, SqlStorageValue> {
  id: string;
  peerId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageId: string;
  unread: number;
  /** The time the owner has read through (0: never): a read recounts `unread` as the peer's messages after it. */
  readThroughAt: number;
}

interface MessageRow extends Record<string, SqlStorageValue> {
  id: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  content: string;
  metadata: string | null;
  createdAt: number;
}

/** A thread between two accounts is named by both, in order; the player id format reserves the delimiter. */
const directThreadId = (a: string, b: string) => [a, b].sort().join("|");

/**
 * One Realms account's direct messages: its threads, its copy of each message, and its own sockets. A message is
 * stored in the recipient's inbox first and then in the sender's, so a failed delivery leaves no one-sided thread.
 * Each message is kept thirty days (retention.ts).
 *
 * It is also the account's chat record: the rooms its sockets joined, and whether the account was deleted. Once it
 * was (`forgetOwner`), it holds nothing, admits no socket, stores no message from a peer and lets the account into no
 * room: the deletion is final here, whatever a socket or a peer still sends.
 */
export class ChatInbox extends DurableObject<Record<string, unknown>> {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, peerId TEXT NOT NULL, createdAt INTEGER NOT NULL,
         updatedAt INTEGER NOT NULL, lastMessageId TEXT NOT NULL, unread INTEGER NOT NULL,
         readThroughAt INTEGER NOT NULL DEFAULT 0);
       CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, threadId TEXT NOT NULL, senderId TEXT NOT NULL,
         recipientId TEXT NOT NULL, content TEXT NOT NULL, metadata TEXT, createdAt INTEGER NOT NULL);
       CREATE INDEX IF NOT EXISTS messages_thread ON messages (threadId, createdAt);
       CREATE INDEX IF NOT EXISTS messages_created ON messages (createdAt);
       CREATE TABLE IF NOT EXISTS rooms (room TEXT PRIMARY KEY);
       CREATE TABLE IF NOT EXISTS deleted (deletedAt INTEGER NOT NULL);
       CREATE TABLE IF NOT EXISTS blocks (realmsId TEXT PRIMARY KEY, blockedAt INTEGER NOT NULL);
       CREATE TABLE IF NOT EXISTS block_list (version INTEGER NOT NULL);
       INSERT INTO block_list (version) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM block_list)`,
    );
    // An inbox made before threads kept their read boundary gains it, once.
    const columns = ctx.storage.sql.exec<{ name: string }>("PRAGMA table_info(threads)").toArray();
    if (!columns.some(({ name }) => name === "readThroughAt"))
      ctx.storage.sql.exec("ALTER TABLE threads ADD COLUMN readThroughAt INTEGER NOT NULL DEFAULT 0");
  }

  /**
   * The owner's socket, admitted by the Worker with the rooms the owner may join. Its handshake carries the owner's
   * conversations, read once the socket is accepted and sent in the same step: every later frame is newer than it.
   */
  override async fetch(request: Request): Promise<Response> {
    const member = chatMemberOf(request);
    if (!member) return new Response("chat member required", { status: 400 });
    if (this.isDeleted()) return new Response("account deleted", { status: 410 });
    await this.forgetExpired();
    await this.ctx.storage.put("owner", member.realmsId);
    const rooms = JSON.parse(request.headers.get("x-chat-rooms") ?? "[]") as string[];
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(member);
    sendChat(server, {
      type: "connected",
      playerId: member.realmsId,
      displayName: member.displayName ?? null,
      channels: rooms,
      threads: this.listThreads(member.realmsId),
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const member = socket.deserializeAttachment() as ChatMember;
    if (this.isDeleted()) return;
    const frame = readChatFrame(socket, data) as { type: string; payload?: unknown; clientMessageId?: string } | null;
    if (!frame || !consumeChatBudget(socket)) return;
    if (frame.type === "direct:message") return this.sendFrom(socket, member, frame.payload, frame.clientMessageId);
    if (frame.type === "direct:typing") return this.relayTyping(member, frame.payload);
    if (frame.type === "direct:read") return this.relayRead(member, frame.payload);
    sendChat(socket, { type: "error", code: "invalid_message", message: "Unknown direct message type." });
  }

  /**
   * A message from another inbox for this owner: stored, then shown on the owner's sockets or pushed to devices. A
   * message from an account the owner blocked is dropped here, unseen, and the sender is told nothing different.
   */
  async receive(message: DirectMessage, senderName?: string): Promise<void> {
    if (this.hasBlocked(message.senderId)) return;
    const thread = this.store(message, message.senderId, 1);
    if (!thread) return;
    await this.forgetExpired();
    const sockets = this.ctx.getWebSockets();
    if (sockets.length > 0) {
      for (const socket of sockets) sendChat(socket, { type: "direct:message", message, thread });
      return;
    }
    await pushDirectMessage(decodeIdentityEnv(this.env), message, senderName);
  }

  async typing(typing: DirectMessageTyping): Promise<void> {
    if (this.isDeleted() || this.hasBlocked(typing.playerId)) return;
    for (const socket of this.ctx.getWebSockets()) sendChat(socket, { type: "direct:typing", typing });
  }

  async read(receipt: DirectMessageReadReceipt): Promise<void> {
    if (this.isDeleted() || this.hasBlocked(receipt.readerId)) return;
    for (const socket of this.ctx.getWebSockets()) sendChat(socket, { type: "direct:read", receipt });
  }

  /**
   * The accounts the owner blocked, most recent first, with the list's version. The version rises with each change
   * and only then, so a client holding two answers keeps the higher: the list as it stands later.
   */
  async blockList(): Promise<BlockList> {
    const sql = this.ctx.storage.sql;
    const blocked = sql
      .exec<{ realmsId: string }>("SELECT realmsId FROM blocks ORDER BY blockedAt DESC")
      .toArray()
      .map(({ realmsId }) => realmsId);
    const { version } = sql.exec<{ version: number }>("SELECT version FROM block_list").one();
    return { blocked, version };
  }

  /**
   * Blocks an account, and answers the list as it stands after: a change, if it was not blocked, raises the version. A
   * deleted owner's list stays empty.
   */
  async block(realmsId: string): Promise<BlockList> {
    if (this.isDeleted()) return this.blockList();
    const added = this.ctx.storage.sql.exec(
      "INSERT INTO blocks (realmsId, blockedAt) VALUES (?, ?) ON CONFLICT DO NOTHING",
      realmsId,
      Date.now(),
    ).rowsWritten;
    if (added > 0) this.ctx.storage.sql.exec("UPDATE block_list SET version = version + 1");
    return this.blockList();
  }

  /** Unblocking lets future messages through; what was dropped while blocked stays dropped. */
  async unblock(realmsId: string): Promise<BlockList> {
    const removed = this.ctx.storage.sql.exec("DELETE FROM blocks WHERE realmsId = ?", realmsId).rowsWritten;
    if (removed > 0) this.ctx.storage.sql.exec("UPDATE block_list SET version = version + 1");
    return this.blockList();
  }

  /**
   * A room the owner's socket is joining: recorded, so a deletion can close it there. False once the owner is deleted:
   * the room then closes that socket.
   */
  enterRoom(room: string): boolean {
    if (this.isDeleted()) return false;
    this.ctx.storage.sql.exec("INSERT INTO rooms (room) VALUES (?) ON CONFLICT DO NOTHING", room);
    return true;
  }

  /**
   * The owner, `realmsId`, deleted their account (account-deletion.ts): the inbox is marked deleted and emptied (its
   * conversations, block list and owner), its sockets close, and so do the owner's sockets in every room it joined.
   * Each peer's inbox keeps its own copy of their conversation, under the same retention as any other. Safe to run
   * again: a run a failure stopped is finished by the next.
   */
  async forgetOwner(realmsId: string): Promise<void> {
    const sql = this.ctx.storage.sql;
    if (!this.isDeleted()) sql.exec("INSERT INTO deleted (deletedAt) VALUES (?)", Date.now());
    sql.exec("DELETE FROM messages; DELETE FROM threads; DELETE FROM blocks");
    await this.ctx.storage.delete("owner");
    await this.ctx.storage.deleteAlarm();
    for (const socket of this.ctx.getWebSockets()) socket.close(1008, "account_deleted");
    const rooms = sql.exec<{ room: string }>("SELECT room FROM rooms").toArray();
    await Promise.all(rooms.map(({ room }) => chatRoomOf(this.env, room).forgetMember(realmsId)));
    sql.exec("DELETE FROM rooms");
  }

  override async alarm(): Promise<void> {
    await this.forgetExpired();
  }

  /**
   * The owner's conversations, the latest first: each thread with its last message and what the owner has not read.
   * This is how a client that starts empty (a new device, a reload, a return after messages came in offline) finds
   * them. Every conversation is listed, one with an account the owner blocked too: the client shows or hides it by the
   * block list, its one source, and what a blocked account sent while blocked was never stored.
   */
  private listThreads(owner: string): { thread: DirectMessageThread; lastMessage: DirectMessage | null }[] {
    const sql = this.ctx.storage.sql;
    return sql
      .exec<ThreadRow>("SELECT * FROM threads ORDER BY updatedAt DESC")
      .toArray()
      .map((row) => {
        const last = sql.exec<MessageRow>("SELECT * FROM messages WHERE id = ?", row.lastMessageId).toArray()[0];
        return { thread: toDirectThread(row, owner), lastMessage: last ? toDirectMessage(last) : null };
      });
  }

  /** One thread's messages for its owner, newest first, a page before the cursor (an ISO time). */
  async threadMessages(
    threadId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ messages: DirectMessage[]; nextCursor: string | null } | null> {
    await this.forgetExpired();
    if (!this.ctx.storage.sql.exec("SELECT 1 FROM threads WHERE id = ?", threadId).toArray().length) return null;
    const before = cursor ? Date.parse(cursor) : Number.MAX_SAFE_INTEGER;
    const rows = this.ctx.storage.sql
      .exec<MessageRow>(
        "SELECT * FROM messages WHERE threadId = ? AND createdAt < ? ORDER BY createdAt DESC LIMIT ?",
        threadId,
        before,
        limit,
      )
      .toArray();
    const messages = rows.map(toDirectMessage);
    return { messages, nextCursor: rows.length === limit ? (messages.at(-1)?.createdAt as string) : null };
  }

  private async sendFrom(socket: WebSocket, member: ChatMember, payload: unknown, clientMessageId?: string) {
    const parsed = Schema.decodeUnknownResult(directMessageCreateSchema)(payload);
    const recipientId = Result.isSuccess(parsed) ? parsed.success.recipientId : null;
    const threadId = recipientId ? directThreadId(member.realmsId, recipientId) : null;
    if (
      Result.isFailure(parsed) ||
      !recipientId ||
      recipientId === member.realmsId ||
      (parsed.success.threadId ?? threadId) !== threadId
    ) {
      sendChat(socket, { type: "error", code: "invalid_direct_payload", message: "Invalid direct message." });
      return;
    }
    const message: DirectMessage = {
      id: crypto.randomUUID(),
      threadId: threadId!,
      senderId: member.realmsId,
      recipientId,
      content: parsed.success.content,
      ...(parsed.success.metadata ? { metadata: parsed.success.metadata } : {}),
      createdAt: new Date().toISOString(),
    };
    try {
      await chatInboxOf(this.env, recipientId).receive(message, member.displayName);
    } catch (error) {
      console.error("direct_message_delivery_failed", error);
      sendChat(socket, {
        type: "error",
        code: "direct_delivery_failed",
        message: "The message could not be delivered.",
      });
      return;
    }
    // The delivery above can wait on the recipient's push service: the owner may be deleted by the time it answers.
    const thread = this.store(message, recipientId, 0);
    if (!thread) return;
    await this.forgetExpired();
    for (const own of this.ctx.getWebSockets())
      sendChat(own, { type: "direct:message", message, thread, clientMessageId });
  }

  private async relayTyping(member: ChatMember, payload: unknown) {
    const parsed = Schema.decodeUnknownResult(directMessageTypingSchema)(payload);
    const peer = Result.isSuccess(parsed) ? this.peerOf(parsed.success.threadId) : null;
    if (Result.isFailure(parsed) || !peer || parsed.success.playerId !== member.realmsId) return;
    await chatInboxOf(this.env, peer).typing(parsed.success);
  }

  private async relayRead(member: ChatMember, payload: unknown) {
    const parsed = Schema.decodeUnknownResult(directMessageReadReceiptSchema)(payload);
    const peer = Result.isSuccess(parsed) ? this.peerOf(parsed.success.threadId) : null;
    if (Result.isFailure(parsed) || !peer || parsed.success.readerId !== member.realmsId) return;
    const { threadId, messageId } = parsed.success;
    const read = this.ctx.storage.sql
      .exec<MessageRow>("SELECT * FROM messages WHERE id = ? AND threadId = ?", messageId, threadId)
      .toArray()[0];
    // Read through that message, never back: what the peer wrote after it stays unread. Every device of the owner is
    // told the recount before anything else can happen here. A receipt for a message this inbox does not hold moves
    // nothing here, and still reaches the peer.
    if (read) {
      this.ctx.storage.sql.exec(
        `UPDATE threads SET readThroughAt = MAX(readThroughAt, ?1),
           unread = (SELECT COUNT(*) FROM messages
             WHERE messages.threadId = threads.id AND messages.senderId = threads.peerId
               AND messages.createdAt > MAX(threads.readThroughAt, ?1))
         WHERE id = ?2`,
        read.createdAt,
        threadId,
      );
      const row = this.ctx.storage.sql.exec<ThreadRow>("SELECT * FROM threads WHERE id = ?", threadId).toArray()[0]!;
      const thread = toDirectThread(row, member.realmsId);
      for (const own of this.ctx.getWebSockets()) sendChat(own, { type: "direct:thread", thread });
    }
    await chatInboxOf(this.env, peer).read(parsed.success);
  }

  private isDeleted(): boolean {
    return this.ctx.storage.sql.exec("SELECT 1 FROM deleted").toArray().length > 0;
  }

  /**
   * Deletes the messages past thirty days, then the threads left without one, and counts what is unread again from
   * what stays; the alarm wakes the inbox when the next message is past (retention.ts). A thread's last message is
   * its newest, so a thread that stays keeps it.
   */
  async forgetExpired() {
    const sql = this.ctx.storage.sql;
    if (sql.exec("DELETE FROM messages WHERE createdAt <= ?", retentionCutoff()).rowsWritten > 0) {
      sql.exec("DELETE FROM threads WHERE NOT EXISTS (SELECT 1 FROM messages WHERE messages.threadId = threads.id)");
      sql.exec(
        `UPDATE threads SET unread = (SELECT COUNT(*) FROM messages WHERE messages.threadId = threads.id
           AND messages.senderId = threads.peerId AND messages.createdAt > threads.readThroughAt)`,
      );
    }
    const { oldest } = sql.exec<{ oldest: number | null }>("SELECT MIN(createdAt) AS oldest FROM messages").one();
    await wakeAtNextExpiry(this.ctx.storage, oldest);
  }

  private hasBlocked(realmsId: string): boolean {
    return this.ctx.storage.sql.exec("SELECT 1 FROM blocks WHERE realmsId = ?", realmsId).toArray().length > 0;
  }

  private peerOf(threadId: string): string | null {
    const row = this.ctx.storage.sql.exec<ThreadRow>("SELECT * FROM threads WHERE id = ?", threadId).toArray()[0];
    return row?.peerId ?? null;
  }

  /**
   * This inbox's copy of a message and its thread, or null once the owner is deleted. Every message and thread is
   * written here, so a send or a delivery still running when the account is deleted cannot bring back what
   * `forgetOwner` cleared.
   */
  private store(message: DirectMessage, peerId: string, unreadIncrement: number): DirectMessageThread | null {
    if (this.isDeleted()) return null;
    const createdAt = Date.parse(message.createdAt as string);
    const sql = this.ctx.storage.sql;
    sql.exec(
      "INSERT INTO messages (id, threadId, senderId, recipientId, content, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      message.id,
      message.threadId,
      message.senderId,
      message.recipientId,
      message.content,
      message.metadata ? JSON.stringify(message.metadata) : null,
      createdAt,
    );
    sql.exec(
      `INSERT INTO threads (id, peerId, createdAt, updatedAt, lastMessageId, unread) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET updatedAt = excluded.updatedAt, lastMessageId = excluded.lastMessageId,
         unread = threads.unread + excluded.unread`,
      message.threadId,
      peerId,
      createdAt,
      createdAt,
      message.id,
      unreadIncrement,
    );
    const thread = sql.exec<ThreadRow>("SELECT * FROM threads WHERE id = ?", message.threadId).toArray()[0]!;
    const owner = peerId === message.senderId ? message.recipientId : message.senderId;
    return toDirectThread(thread, owner);
  }
}

/** The owner has no socket open: a privacy-safe alert to each device that opted in to direct messages. */
const pushDirectMessage = (env: IdentityEnv, message: DirectMessage, senderName?: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const owner = message.recipientId;
      const levels = yield* (yield* NotificationPreferenceStore).levels([owner]);
      if (!includesKind(levels.get(owner) ?? "off", "messages")) return;
      const store = yield* PushSubscriptionStore;
      const devices = yield* store.chatAlertDevices(owner, Date.now());
      const notification = buildDirectMessageNotification(
        {
          messageId: message.id,
          threadId: message.threadId,
          recipientOwner: owner,
          ...(senderName ? { senderDisplayName: senderName.slice(0, 64) } : {}),
          createdAt: Date.parse(message.createdAt as string),
        },
        Date.now(),
      );
      for (const device of devices) {
        const outcome = yield* Effect.promise(() =>
          sendToDevice(env, device, {
            version: 1,
            kind: "direct-message",
            subscriptionId: device.id,
            notification,
          }),
        );
        if (outcome === "expired") yield* store.expire(owner, device.id);
      }
    }).pipe(
      Effect.provide(NotificationPreferenceStore.layer(env.DB)),
      Effect.provide(PushSubscriptionStore.layer(env.DB)),
      Effect.catchCause((cause) => Effect.sync(() => console.error("direct_message_push_failed", cause))),
    ),
  );

const toDirectMessage = (row: MessageRow): DirectMessage => ({
  id: row.id,
  threadId: row.threadId,
  senderId: row.senderId,
  recipientId: row.recipientId,
  content: row.content,
  createdAt: new Date(row.createdAt).toISOString(),
  ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
});

const toDirectThread = (row: ThreadRow, owner: string): DirectMessageThread => ({
  id: row.id,
  participants: [owner, row.peerId].sort() as [string, string],
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
  lastMessageId: row.lastMessageId,
  unreadCounts: { [owner]: row.unread },
  typing: [],
});
