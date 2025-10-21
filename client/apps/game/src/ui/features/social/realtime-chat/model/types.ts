import type {
  DirectMessage,
  DirectMessageCreatePayload,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageTyping,
} from "../../../../../../../../../../../common/validation/realtime/direct-messages";
import type {
  WorldChatHistoryQuery,
  WorldChatMessage,
  WorldChatPublishPayload,
} from "../../../../../../../../../../../common/validation/realtime/world-chat";
import { RealtimeClient } from "../../../../../../../../../shared/realtime/client";

export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface RealtimePlayerIdentity {
  playerId: string;
  walletAddress?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface PlayerPresence {
  playerId: string;
  displayName?: string | null;
  walletAddress?: string | null;
  lastSeenAt?: string | null;
  isOnline: boolean;
  isTypingInThreadIds: string[];
  lastZoneId?: string | null;
}

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

export interface WorldChatZoneState {
  zoneId: string;
  messages: WorldChatMessage[];
  unreadCount: number;
  hasMoreHistory: boolean;
  lastFetchedCursor?: string | null;
  isFetchingHistory: boolean;
  pendingMessages: PendingMessage[];
}

export interface DirectMessageThreadState {
  thread: DirectMessageThread;
  messages: DirectMessage[];
  unreadCount: number;
  hasMoreHistory: boolean;
  lastFetchedCursor?: string | null;
  isFetchingHistory: boolean;
  pendingMessages: PendingMessage[];
}

export interface RealtimeChatState {
  client: RealtimeClient | null;
  connectionStatus: RealtimeConnectionStatus;
  lastConnectionError?: string;
  identity?: RealtimePlayerIdentity;
  baseUrl?: string;
  activeZoneId?: string;
  activeThreadId?: string;
  worldZones: Record<string, WorldChatZoneState>;
  dmThreads: Record<string, DirectMessageThreadState>;
  unreadWorldTotal: number;
  unreadDirectTotal: number;
  onlinePlayers: Record<string, PlayerPresence>;
  typingIndicators: Record<string, DirectMessageTyping>;
  pendingReadReceipts: DirectMessageReadReceipt[];
}

export interface InitializeRealtimeClientParams {
  baseUrl: string;
  identity: RealtimePlayerIdentity;
  joinZones?: string[];
  queryParams?: Record<string, string | undefined>;
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
  leaveZone(zoneId: string): void;
  setActiveZone(zoneId: string | undefined): void;
  setActiveThread(threadId: string | undefined): void;
  receiveWorldMessage(zoneId: string, message: WorldChatMessage, options?: { clientMessageId?: string }): void;
  receiveDirectMessage(message: DirectMessage): void;
  setWorldHistory(zoneId: string, messages: WorldChatMessage[], meta?: Partial<WorldChatZoneState>): void;
  setDirectHistory(threadId: string, messages: DirectMessage[], meta?: Partial<DirectMessageThreadState>): void;
  setOnlinePlayers(players: PlayerPresence[]): void;
  upsertOnlinePlayer(player: PlayerPresence): void;
  markZoneAsRead(zoneId: string): void;
  markThreadAsRead(threadId: string): void;
  enqueuePendingMessage(message: PendingMessage): void;
  resolvePendingMessage(messageId: string, updates: Partial<PendingMessage>): void;
  sendWorldMessage(zoneId: string, payload: WorldChatPublishPayload): Promise<void>;
  sendDirectMessage(threadId: string | undefined, recipientId: string, content: string): Promise<void>;
  acknowledgeDirectRead(receipt: DirectMessageReadReceipt): Promise<void>;
  updateTypingState(payload: DirectMessageTyping): void;
  setWorldHistoryLoading(zoneId: string, isLoading: boolean): void;
  setDirectHistoryLoading(threadId: string, isLoading: boolean): void;
  loadWorldHistory(params: LoadWorldChatHistoryParams): Promise<void>;
  loadDirectHistory(threadId: string, cursor?: string): Promise<void>;
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
} from "../../../../../../../../../../../common/validation/realtime/direct-messages";
export type { WorldChatHistoryQuery, WorldChatMessage, WorldChatPublishPayload } from "../../../../../../../../../../../common/validation/realtime/world-chat";
