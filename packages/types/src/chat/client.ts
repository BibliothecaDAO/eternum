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
  | { type: "joined:zone"; zoneId: string }
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
   * Optional factory for constructing WebSocket instances.
   * This enables dependency injection during tests or on platforms
   * that do not expose `WebSocket` as a global.
   */
  createSocket?: (url: string) => WebSocket;
  onOpen?(socket: WebSocket): void;
  onMessage?(message: RealtimeServerMessage, raw?: MessageEvent): void;
  onClose?(event: CloseEvent): void;
  onError?(event: Event): void;
}

/**
 * The chat transport: one socket to the account's inbox, which carries direct messages and names the rooms the account
 * may join, and one socket per joined room. Its user sees one message stream, as with a single connection. Presence
 * comes from the world room only: everyone is in it, and a player leaving a game room is still online.
 */
export class RealtimeClient {
  #inbox: WebSocket;
  #rooms = new Map<string, WebSocket>();
  #options: RealtimeClientOptions;

  constructor(options: RealtimeClientOptions) {
    this.#options = options;
    this.#inbox = this.#connectInbox();
  }

  joinZone(zoneId: string) {
    if (!this.#rooms.has(zoneId)) this.#rooms.set(zoneId, this.#connectRoom(zoneId));
  }

  leaveZone(zoneId: string) {
    const room = this.#rooms.get(zoneId);
    if (!room) return;
    this.#rooms.delete(zoneId);
    room.close();
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
      this.#inbox = this.#connectInbox();
    }
    sendWhenOpen(this.#inbox, message);
  }

  close() {
    this.#inbox.close();
    for (const room of this.#rooms.values()) room.close();
    this.#rooms.clear();
  }

  #connectInbox() {
    const socket = this.#open("/api/chat/inbox");
    socket.addEventListener("open", () => this.#options.onOpen?.(socket));
    socket.addEventListener("message", (event) => {
      const message = safeParse(event.data);
      if (!message) return;
      if (message.type === "connected") {
        for (const zoneId of (message.channels as string[] | undefined) ?? []) this.joinZone(zoneId);
      }
      this.#options.onMessage?.(message, event);
    });
    socket.addEventListener("close", (event) => this.#options.onClose?.(event));
    socket.addEventListener("error", (event) => this.#options.onError?.(event));
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
    socket.addEventListener("close", () => {
      if (this.#rooms.get(zoneId) !== socket) return;
      this.#rooms.delete(zoneId);
      this.#options.onMessage?.({ type: "left:zone", zoneId });
    });
    return socket;
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
