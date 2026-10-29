import type {
  BlockList,
  DirectMessage,
  DirectMessageCreatePayload,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageTyping,
  PlayerPresencePayload,
  WorldChatHistoryQuery,
  WorldChatMessage,
  WorldChatPublishPayload,
} from "@bibliothecadao/types";

import { RealtimeClient } from "@bibliothecadao/types";

/** "reconnecting": a socket dropped and the client is opening it again by itself. */
export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface RealtimePlayerIdentity {
  playerId: string;
  displayName?: string;
}

export type PlayerPresence = PlayerPresencePayload & {
  isTypingInThreadIds: string[];
};

export interface PendingMessage {
  id: string;
  content: string;
  createdAt: string;
  zoneId?: string;
  recipientId?: string;
  threadId?: string;
  status: "sending" | "sent" | "error";
  errorMessage?: string;
}

/**
 * What the chat shows: a room, the list of private conversations (Messages), or one conversation. Private messages are
 * never drawn in a room (owner, 28 October 2026: "its a bit weird mixing the dm with the global chat imo").
 */
export type ChatView =
  | { kind: "room"; zoneId: string }
  | { kind: "messages" }
  | { kind: "conversation"; threadId: string };

export interface WorldChatZoneState {
  historyError?: string;
  zoneId: string;
  messages: WorldChatMessage[];
  unreadCount: number;
  hasMoreHistory: boolean;
  lastFetchedCursor?: string | null;
  isFetchingHistory: boolean;
  pendingMessages: PendingMessage[];
}

export interface DirectMessageThreadState {
  /** The thread as the server last sent it: its unread count is the only one (directUnread reads it). */
  thread: DirectMessageThread;
  messages: DirectMessage[];
  /** The other player's line this connection last told the server the player read through (receiptDue). */
  receiptSent?: string;
  hasMoreHistory: boolean;
  lastFetchedCursor?: string | null;
  isFetchingHistory: boolean;
  pendingMessages: PendingMessage[];
}

export interface RealtimeChatState {
  client: RealtimeClient | null;
  connectionStatus: RealtimeConnectionStatus;
  joinedZoneIds: string[];
  lastConnectionError?: string;
  identity?: RealtimePlayerIdentity;
  baseUrl?: string;
  activeZoneId?: string;
  activeThreadId?: string;
  isShellOpen: boolean;
  worldZones: Record<string, WorldChatZoneState>;
  dmThreads: Record<string, DirectMessageThreadState>;
  unreadWorldTotal: number;
  onlinePlayers: Record<string, PlayerPresence>;
  typingIndicators: Record<string, DirectMessageTyping>;
  pendingReadReceipts: DirectMessageReadReceipt[];
  view: ChatView;
  /**
   * The server's block list, the accounts this player muted, with its version: their direct messages never arrive, and
   * what they write is hidden. Null until that list is read: a room's messages wait for it (heldWorldMessages), since
   * who is muted is not known, never taken to be nobody. Of two answers, the higher version is held.
   */
  blockList: BlockList | null;
  /** Room messages that arrived before the block list was read, taken in order once it is. */
  heldWorldMessages: HeldWorldMessage[];
  /** The rooms the player has where they stand (chatRooms), as the transport opens them; setRooms moves them. */
  rooms: string[];
  /** Rooms the player reads but may not write in, as each room answered at its open (a Blitz lobby's, unregistered). */
  readOnlyZoneIds: string[];
  /** Why a room did not take the player's last message, until they send again: too fast, or refused. */
  roomRefusals: Record<string, RoomRefusal>;
}

export type RoomRefusal = "rate-limited" | "refused";

export interface HeldWorldMessage {
  zoneId: string;
  message: WorldChatMessage;
  clientMessageId?: string;
}

export interface InitializeRealtimeClientParams {
  baseUrl: string;
  /** The rooms the player has where they stand (chatRooms): the only rooms opened, of those the server allows. */
  rooms: string[];
}

export interface LoadWorldChatHistoryParams extends Pick<WorldChatHistoryQuery, "cursor" | "limit" | "since"> {
  zoneId: string;
  replaceExisting?: boolean;
}

export interface RealtimeChatActions {
  initializeClient(params: InitializeRealtimeClientParams): void;
  resetClient(): void;
  setConnectionStatus(status: RealtimeConnectionStatus, errorMessage?: string): void;
  joinZone(zoneId: string): void;
  /** Shows a room, joined and read there. */
  showRoom(zoneId: string): void;
  /** Shows the list of private conversations. */
  showMessages(): void;
  /** Opens the conversation with a player, started if there is none: a name pressed in a room leads here. */
  openConversation(playerId: string): void;
  setActiveZone(zoneId: string | undefined): void;
  /** The rooms where the player now stands: the transport leaves the ones gone and opens the new ones. */
  setRooms(rooms: readonly string[]): void;
  /** A room opened again, so it answers anew who writes there (after the player registered in a Blitz lobby). */
  reopenRoom(zoneId: string): void;
  /** A room did not take the player's message (`code`, as the room said it): it leaves the room, and why is shown. */
  refuseInRoom(zoneId: string, code: string): void;
  setShellOpen(isOpen: boolean): void;
  ensureDirectThread(participantId: string): string | undefined;
  setActiveThread(threadId: string | undefined): void;
  receiveWorldMessage(zoneId: string, message: WorldChatMessage, options?: { clientMessageId?: string }): void;
  receiveDirectMessage(message: DirectMessage, thread?: DirectMessageThread): void;
  setWorldHistory(zoneId: string, messages: WorldChatMessage[], meta?: Partial<WorldChatZoneState>): void;
  setDirectHistory(threadId: string, messages: DirectMessage[], meta?: Partial<DirectMessageThreadState>): void;
  setOnlinePlayers(players: PlayerPresence[]): void;
  upsertOnlinePlayer(player: PlayerPresence): void;
  markZoneAsRead(zoneId: string): void;
  markThreadAsRead(threadId: string): void;
  enqueuePendingMessage(message: PendingMessage): void;
  resolvePendingMessage(messageId: string, updates: Partial<PendingMessage>): void;
  sendWorldMessage(zoneId: string, payload: WorldChatPublishPayload): Promise<void>;
  sendDirectMessage(
    threadId: string | undefined,
    recipientId: string,
    content: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  acknowledgeDirectRead(receipt: DirectMessageReadReceipt): Promise<void>;
  updateTypingState(payload: DirectMessageTyping): void;
  setWorldHistoryLoading(zoneId: string, isLoading: boolean): void;
  setDirectHistoryLoading(threadId: string, isLoading: boolean): void;
  loadWorldHistory(params: LoadWorldChatHistoryParams): Promise<void>;
  loadDirectHistory(threadId: string, cursor?: string): Promise<void>;
  loadBlockedPlayers(): Promise<void>;
  blockPlayer(playerId: string): Promise<void>;
  unblockPlayer(playerId: string): Promise<void>;
}

export type RealtimeChatStore = RealtimeChatState & {
  actions: RealtimeChatActions;
};

export interface WorldChatOutboundMessage {
  type: "world:publish";
  zoneId: string;
  payload: WorldChatPublishPayload;
  clientMessageId?: string;
}

export interface DirectMessageOutboundMessage {
  type: "direct:message";
  payload: DirectMessageCreatePayload;
  clientMessageId?: string;
}

export type {
  DirectMessage,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageTyping,
  WorldChatMessage,
  WorldChatPublishPayload,
} from "@bibliothecadao/types";
