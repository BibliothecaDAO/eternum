import type {
  DirectMessage,
  DirectMessageCreatePayload,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageTyping,
} from "./direct-messages";
import type { WorldChatMessage, WorldChatPublishPayload } from "./world-chat";

export type JoinZoneMessage = { type: "join:zone"; zoneId: string };
export type LeaveZoneMessage = { type: "leave:zone"; zoneId: string };
export type WorldPublishMessage = {
  type: "world:publish";
  zoneId: string;
  payload: WorldChatPublishPayload;
  clientMessageId?: string;
};
export type DirectMessageSendMessage = {
  type: "direct:message";
  payload: DirectMessageCreatePayload;
  clientMessageId?: string;
};
export type DirectTypingMessage = {
  type: "direct:typing";
  payload: DirectMessageTyping;
};
export type DirectReadMessage = {
  type: "direct:read";
  payload: DirectMessageReadReceipt;
};

export interface PlayerPresencePayload {
  playerId: string;
  displayName?: string | null;
  walletAddress?: string | null;
  lastSeenAt?: string | null;
  isOnline: boolean;
  isTypingInThreadIds?: string[];
  lastZoneId?: string | null;
}

export type RealtimeClientMessage =
  | JoinZoneMessage
  | LeaveZoneMessage
  | WorldPublishMessage
  | DirectMessageSendMessage
  | DirectTypingMessage
  | DirectReadMessage
  | { type: string; [key: string]: unknown };

export type WorldBroadcastMessage = {
  type: "world:message";
  zoneId: string;
  message: WorldChatMessage;
  clientMessageId?: string;
};

export type DirectBroadcastMessage = {
  type: "direct:message";
  message: DirectMessage;
  thread: DirectMessageThread;
  clientMessageId?: string;
};

export type DirectTypingBroadcastMessage = {
  type: "direct:typing";
  typing: DirectMessageTyping;
};

export type DirectReadBroadcastMessage = {
  type: "direct:read";
  receipt: DirectMessageReadReceipt;
};

export type PresenceSyncBroadcastMessage = {
  type: "presence:sync";
  players: PlayerPresencePayload[];
};

export type PresenceUpdateBroadcastMessage = {
  type: "presence:update";
  player: PlayerPresencePayload;
};

export type RealtimeServerMessage =
  | { type: "connected"; playerId: string }
  | { type: "joined:zone"; zoneId: string }
  | { type: "left:zone"; zoneId: string }
  | WorldBroadcastMessage
  | DirectBroadcastMessage
  | DirectTypingBroadcastMessage
  | DirectReadBroadcastMessage
  | PresenceSyncBroadcastMessage
  | PresenceUpdateBroadcastMessage
  | { type: "error"; message: string; code?: string }
  | { type: string; [key: string]: unknown };

export interface RealtimeClientOptions {
  baseUrl: string;
  playerId: string;
  /**
   * Override the websocket path appended to the base URL.
   * Defaults to `/ws`.
   */
  websocketPath?: string;
  /**
   * Additional query parameters appended to the websocket URL.
   * Useful when extra identity information (e.g. wallet address) must be sent
   * as part of the handshake.
   */
  queryParams?: Record<string, string | undefined>;
  /**
   * Optional factory for constructing WebSocket instances.
   * This enables dependency injection during tests or on platforms
   * that do not expose `WebSocket` as a global.
   */
  createSocket?: (url: string) => WebSocket;
  onOpen?(socket: WebSocket): void;
  onMessage?(message: RealtimeServerMessage, raw: MessageEvent): void;
  onClose?(event: CloseEvent): void;
  onError?(event: Event): void;
}

export class RealtimeClient {
  #socket: WebSocket;
  #options: RealtimeClientOptions;

  constructor(options: RealtimeClientOptions) {
    this.#options = options;
    this.#socket = this.#connect();
  }

  get socket() {
    return this.#socket;
  }

  joinZone(zoneId: string) {
    this.send({ type: "join:zone", zoneId });
  }

  leaveZone(zoneId: string) {
    this.send({ type: "leave:zone", zoneId });
  }

  send(message: RealtimeClientMessage) {
    if (this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message));
      return;
    }

    if (this.#socket.readyState === WebSocket.CONNECTING) {
      const handleOpen = () => {
        this.#socket.removeEventListener("open", handleOpen);
        this.#socket.send(JSON.stringify(message));
      };
      this.#socket.addEventListener("open", handleOpen, { once: true });
      return;
    }

    this.#socket = this.#connect();
    const handleOpen = () => {
      this.#socket.removeEventListener("open", handleOpen);
      this.#socket.send(JSON.stringify(message));
    };
    this.#socket.addEventListener("open", handleOpen, { once: true });
  }

  close() {
    this.#socket.close();
  }

  #connect() {
    const url = this.#buildWebSocketUrl();
    const socketFactory = this.#options.createSocket ?? ((target: string) => new WebSocket(target));
    const socket = socketFactory(url);

    socket.addEventListener("open", () => {
      this.#options.onOpen?.(socket);
    });

    socket.addEventListener("message", (event) => {
      const message = this.#safeParse(event.data);
      if (message) {
        this.#options.onMessage?.(message, event);
      }
    });

    socket.addEventListener("close", (event) => {
      this.#options.onClose?.(event);
    });

    socket.addEventListener("error", (event) => {
      this.#options.onError?.(event);
    });

    return socket;
  }

  #buildWebSocketUrl() {
    const url = new URL(this.#options.baseUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    }

    url.pathname = this.#options.websocketPath ?? "/ws";
    url.searchParams.set("playerId", this.#options.playerId);

    if (this.#options.queryParams) {
      for (const [key, value] of Object.entries(this.#options.queryParams)) {
        if (typeof value === "string") {
          url.searchParams.set(key, value);
        }
      }
    }

    return url.toString();
  }

  #safeParse(payload: unknown): RealtimeServerMessage | undefined {
    try {
      if (typeof payload === "string") {
        return JSON.parse(payload) as RealtimeServerMessage;
      }

      if (typeof payload === "object" && payload) {
        return payload as RealtimeServerMessage;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }
}
