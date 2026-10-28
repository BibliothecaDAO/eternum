import type {
  DirectMessage,
  DirectMessageCreatePayload,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageTyping,
} from "./direct-messages";
import { GLOBAL_CHAT_CHANNEL_ID, type WorldChatMessage, type WorldChatPublishPayload } from "./world-chat";

export type JoinZoneMessage = { type: "join:zone"; zoneId: string };
export type LeaveZoneMessage = { type: "leave:zone"; zoneId: string };
export type WorldPublishMessage = {
  type: "world:publish";
  zoneId: string;
  payload: WorldChatPublishPayload;
  clientMessageId?: string;
};
type DirectMessageSendMessage = {
  type: "direct:message";
  payload: DirectMessageCreatePayload;
  clientMessageId?: string;
};
type DirectTypingMessage = {
  type: "direct:typing";
  payload: DirectMessageTyping;
};
type DirectReadMessage = {
  type: "direct:read";
  payload: DirectMessageReadReceipt;
};

export interface PlayerPresencePayload {
  playerId: string;
  displayName?: string | null;
  isOnline: boolean;
  isTypingInThreadIds?: string[];
}

export type RealtimeClientMessage =
  | JoinZoneMessage
  | LeaveZoneMessage
  | WorldPublishMessage
  | DirectMessageSendMessage
  | DirectTypingMessage
  | DirectReadMessage
  | { type: string; [key: string]: unknown };

type WorldBroadcastMessage = {
  type: "world:message";
  zoneId: string;
  message: WorldChatMessage;
  clientMessageId?: string;
};

type DirectBroadcastMessage = {
  type: "direct:message";
  message: DirectMessage;
  thread: DirectMessageThread;
  clientMessageId?: string;
};

type DirectTypingBroadcastMessage = {
  type: "direct:typing";
  typing: DirectMessageTyping;
};

type DirectReadBroadcastMessage = {
  type: "direct:read";
  receipt: DirectMessageReadReceipt;
};

type PresenceSyncBroadcastMessage = {
  type: "presence:sync";
  players: PlayerPresencePayload[];
};

type PresenceUpdateBroadcastMessage = {
  type: "presence:update";
  player: PlayerPresencePayload;
};

type PresenceRemoveBroadcastMessage = {
  type: "presence:remove";
  playerId: string;
};

export type RealtimeServerMessage =
  | { type: "connected"; playerId: string; displayName?: string | null; channels: string[] }
  | { type: "joined:zone"; zoneId: string; canWrite?: boolean }
  | { type: "left:zone"; zoneId: string }
  | WorldBroadcastMessage
  | DirectBroadcastMessage
  | DirectTypingBroadcastMessage
  | DirectReadBroadcastMessage
  | PresenceSyncBroadcastMessage
  | PresenceUpdateBroadcastMessage
  | PresenceRemoveBroadcastMessage
  | { type: "error"; message: string; code?: string }
  | { type: string; [key: string]: unknown };

export interface RealtimeClientOptions {
  /** The app's origin: chat is served under its /api/chat. */
  baseUrl: string;
  /**
   * The rooms the player has where they stand (Global, and a game's own where its mode keeps one). The inbox's handshake
   * names every room the account may read; only these are opened, so a room the player is not shown never streams to
   * them, and every handshake (each reconnect) opens them again.
   */
  rooms: readonly string[];
  /**
   * Optional factory for constructing WebSocket instances.
   * This enables dependency injection during tests or on platforms
   * that do not expose `WebSocket` as a global.
   */
  createSocket?: (url: string) => WebSocket;
  onOpen?(socket: WebSocket): void;
  onMessage?(message: RealtimeServerMessage, raw?: MessageEvent): void;
  onClose?(event: CloseEvent): void;
  onError?(event: Event): void;
  /** A socket dropped and will be opened again by itself: the inbox, or a room the account had joined. */
  onReconnecting?(): void;
}

/**
 * How long a dropped socket waits before it is opened again, longer after each failure in a row. The last delay
 * repeats: the server allows thirty opens a minute for an account, and a refused room must not spend them.
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const INBOX = "inbox";

/**
 * The chat transport: one socket to the account's inbox, which carries direct messages and names the rooms the account
 * may join, and one socket per joined room. Its user sees one message stream, as with a single connection. Presence
 * comes from the world room only: everyone is in it, and a player leaving a game room is still online.
 *
 * A socket that drops is opened again by itself; one closed on purpose (the client closed, a room left) stays closed.
 * Only the socket a connection currently holds speaks for it: a replaced socket's late events are ignored.
 */
export class RealtimeClient {
  #inbox: WebSocket;
  #rooms = new Map<string, WebSocket>();
  #options: RealtimeClientOptions;
  #closed = false;
  /** Failures in a row and the pending reopen, per connection: the inbox, or a room by its zone. */
  #failures = new Map<string, number>();
  #reopening = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: RealtimeClientOptions) {
    this.#options = options;
    this.#inbox = this.#connectInbox();
  }

  joinZone(zoneId: string) {
    if (!this.#rooms.has(zoneId)) this.#rooms.set(zoneId, this.#connectRoom(zoneId));
  }

  leaveZone(zoneId: string) {
    this.#forgetReopening(zoneId);
    const room = this.#rooms.get(zoneId);
    if (!room) return;
    this.#rooms.delete(zoneId);
    closeQuietly(room);
    this.#options.onMessage?.({ type: "left:zone", zoneId });
  }

  send(message: RealtimeClientMessage) {
    if (message.type === "join:zone") return this.joinZone((message as JoinZoneMessage).zoneId);
    if (message.type === "leave:zone") return this.leaveZone((message as LeaveZoneMessage).zoneId);
    if (message.type === "world:publish") {
      const zoneId = (message as WorldPublishMessage).zoneId;
      this.joinZone(zoneId);
      return sendWhenOpen(this.#rooms.get(zoneId)!, message);
    }
    if (this.#inbox.readyState === WebSocket.CLOSED || this.#inbox.readyState === WebSocket.CLOSING) {
      // Opened again now, for this message: the reopen that was waiting is no longer owed.
      this.#forgetReopening(INBOX);
      this.#inbox = this.#connectInbox();
    }
    sendWhenOpen(this.#inbox, message);
  }

  close() {
    this.#closed = true;
    for (const zoneId of [...this.#reopening.keys()]) this.#forgetReopening(zoneId);
    closeQuietly(this.#inbox);
    for (const room of this.#rooms.values()) closeQuietly(room);
    this.#rooms.clear();
  }

  #connectInbox() {
    const socket = this.#open("/api/chat/inbox");
    const isInbox = () => !this.#closed && this.#inbox === socket;
    socket.addEventListener("open", () => {
      if (!isInbox()) return;
      this.#failures.delete(INBOX);
      this.#options.onOpen?.(socket);
    });
    socket.addEventListener("message", (event) => {
      if (!isInbox()) return;
      const message = safeParse(event.data);
      if (!message) return;
      if (message.type === "connected") {
        const allowed = (message.channels as string[] | undefined) ?? [];
        for (const zoneId of allowed) if (this.#options.rooms.includes(zoneId)) this.joinZone(zoneId);
      }
      this.#options.onMessage?.(message, event);
    });
    socket.addEventListener("close", (event) => {
      if (!isInbox()) return;
      this.#options.onClose?.(event);
      this.#reopenLater(INBOX, () => {
        this.#inbox = this.#connectInbox();
      });
    });
    socket.addEventListener("error", (event) => {
      if (isInbox()) this.#options.onError?.(event);
    });
    return socket;
  }

  #connectRoom(zoneId: string) {
    const socket = this.#open(`/api/chat/rooms/${encodeURIComponent(zoneId)}`);
    socket.addEventListener("message", (event) => {
      const message = safeParse(event.data);
      if (!message) return;
      if (message.type.startsWith("presence:") && zoneId !== GLOBAL_CHAT_CHANNEL_ID) return;
      this.#options.onMessage?.(message, event);
    });
    socket.addEventListener("open", () => {
      if (this.#rooms.get(zoneId) === socket) this.#failures.delete(zoneId);
    });
    socket.addEventListener("close", () => {
      if (this.#rooms.get(zoneId) !== socket) return;
      this.#rooms.delete(zoneId);
      this.#options.onMessage?.({ type: "left:zone", zoneId });
      this.#reopenLater(zoneId, () => this.joinZone(zoneId));
    });
    return socket;
  }

  /** A connection that dropped by itself is opened again after its next delay, and its user is told it will be. */
  #reopenLater(connection: string, reopen: () => void) {
    if (this.#closed || this.#reopening.has(connection)) return;
    const failures = this.#failures.get(connection) ?? 0;
    this.#failures.set(connection, failures + 1);
    this.#options.onReconnecting?.();
    this.#reopening.set(
      connection,
      setTimeout(
        () => {
          this.#reopening.delete(connection);
          if (!this.#closed) reopen();
        },
        RECONNECT_DELAYS_MS[Math.min(failures, RECONNECT_DELAYS_MS.length - 1)],
      ),
    );
  }

  #forgetReopening(connection: string) {
    clearTimeout(this.#reopening.get(connection));
    this.#reopening.delete(connection);
    this.#failures.delete(connection);
  }

  #open(path: string) {
    const url = new URL(this.#options.baseUrl);
    url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
    url.pathname = path;
    url.search = "";
    const socketFactory = this.#options.createSocket ?? ((target: string) => new WebSocket(target));
    return socketFactory(url.toString());
  }
}

/**
 * Closes a socket this client no longer wants. One still connecting is closed once it opens: closing it sooner makes
 * the browser report "WebSocket is closed before the connection is established" for what is only a cleanup.
 */
const closeQuietly = (socket: WebSocket) => {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true });
    return;
  }
  socket.close();
};

const sendWhenOpen = (socket: WebSocket, message: RealtimeClientMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return;
  }
  socket.addEventListener("open", () => socket.send(JSON.stringify(message)), { once: true });
};

const safeParse = (payload: unknown): RealtimeServerMessage | undefined => {
  try {
    if (typeof payload === "string") return JSON.parse(payload) as RealtimeServerMessage;
    if (typeof payload === "object" && payload) return payload as RealtimeServerMessage;
    return undefined;
  } catch {
    return undefined;
  }
};
