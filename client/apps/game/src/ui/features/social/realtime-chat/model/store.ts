import { create } from "zustand";

import { RealtimeClient, type PlayerPresencePayload } from "@bibliothecadao/types";
import type {
  DirectMessage,
  DirectMessageOutboundMessage,
  DirectMessageReadReceipt,
  DirectMessageThread,
  DirectMessageThreadState,
  DirectMessageTyping,
  InitializeRealtimeClientParams,
  LoadWorldChatHistoryParams,
  PendingMessage,
  RealtimeChatStore,
  PlayerPresence,
  RealtimeConnectionStatus,
  WorldChatMessage,
  WorldChatOutboundMessage,
  WorldChatZoneState,
} from "./types";

const normalizeHttpBaseUrl = (raw: string): string => {
  try {
    const url = new URL(raw);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    if (!raw) {
      return raw;
    }

    try {
      const fallback = new URL(`http://${raw}`);
      return fallback.toString();
    } catch {
      return raw;
    }
  }
};

const createWorldZoneState = (zoneId: string): WorldChatZoneState => ({
  zoneId,
  messages: [],
  unreadCount: 0,
  hasMoreHistory: true,
  lastFetchedCursor: undefined,
  isFetchingHistory: false,
  pendingMessages: [],
});

const createThreadState = (thread: DirectMessageThreadState["thread"]): DirectMessageThreadState => ({
  thread,
  messages: [],
  unreadCount: 0,
  hasMoreHistory: true,
  lastFetchedCursor: undefined,
  isFetchingHistory: false,
  pendingMessages: [],
});

const normalizePresencePayload = (presence: PlayerPresencePayload): PlayerPresence => ({
  playerId: presence.playerId,
  displayName: presence.displayName ?? null,
  walletAddress: presence.walletAddress ?? null,
  lastSeenAt: presence.lastSeenAt ?? null,
  isOnline: Boolean(presence.isOnline),
  isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
  lastZoneId: presence.lastZoneId ?? null,
});

const createFallbackThread = (message: DirectMessage): DirectMessageThread => {
  const createdAt =
    message.createdAt instanceof Date
      ? message.createdAt.toISOString()
      : (message.createdAt ?? new Date().toISOString());
  const participants = [message.senderId, message.recipientId] as [string, string];
  participants.sort();
  return {
    id: message.threadId,
    participants,
    createdAt,
    updatedAt: createdAt,
    lastMessageId: message.id,
    unreadCounts: {},
  };
};

const normalizeWorldChatMessage = (message: WorldChatMessage): WorldChatMessage => ({
  ...message,
  createdAt:
    message.createdAt instanceof Date
      ? message.createdAt.toISOString()
      : (message.createdAt ?? new Date().toISOString()),
  location: message.location ?? undefined,
  metadata: message.metadata ?? undefined,
  sender: {
    playerId: message.sender.playerId,
    walletAddress: message.sender.walletAddress ?? undefined,
    displayName: message.sender.displayName ?? undefined,
    avatarUrl: message.sender.avatarUrl ?? undefined,
  },
});

const mapWorldChatRecordToMessage = (record: any, fallbackZoneId: string): WorldChatMessage =>
  normalizeWorldChatMessage({
    id: record.id,
    zoneId: record.zoneId ?? fallbackZoneId,
    content: record.content,
    createdAt: record.createdAt ?? new Date().toISOString(),
    location: record.location ?? undefined,
    metadata: record.metadata ?? undefined,
    sender: {
      playerId: record.sender?.playerId ?? record.senderId ?? "unknown",
      walletAddress: record.sender?.walletAddress ?? record.senderWallet ?? undefined,
      displayName: record.sender?.displayName ?? record.senderDisplayName ?? undefined,
      avatarUrl: record.sender?.avatarUrl ?? record.senderAvatarUrl ?? undefined,
    },
  });

const initialState: Omit<RealtimeChatStore, "actions"> = {
  client: null,
  connectionStatus: "idle",
  lastConnectionError: undefined,
  identity: undefined,
  baseUrl: undefined,
  activeZoneId: undefined,
  activeThreadId: undefined,
  worldZones: {},
  dmThreads: {},
  unreadWorldTotal: 0,
  unreadDirectTotal: 0,
  onlinePlayers: {},
  typingIndicators: {},
  pendingReadReceipts: [],
};

export const useRealtimeChatStore = create<RealtimeChatStore>((set, get) => ({
  ...initialState,
  actions: {
    initializeClient: (params: InitializeRealtimeClientParams) => {
      const { client: existingClient } = get();
      existingClient?.close();

      const client = new RealtimeClient({
        baseUrl: params.baseUrl,
        playerId: params.identity.playerId,
        queryParams: params.queryParams,
        onOpen: () => {
          set({
            connectionStatus: "connected",
            lastConnectionError: undefined,
          });
          params.joinZones?.forEach((zoneId) => client.joinZone(zoneId));
        },
        onClose: (event) => {
          set({
            connectionStatus: event.wasClean ? "idle" : "error",
            lastConnectionError: event.reason || undefined,
          });
        },
        onError: (event) => {
          set({
            connectionStatus: "error",
            lastConnectionError: event instanceof Event ? event.type : String(event),
          });
        },
        onMessage: (message) => {
          const { actions } = get();

          switch (message.type) {
            case "world:message":
              actions.receiveWorldMessage(message.zoneId, message.message, {
                clientMessageId: message.clientMessageId,
              });
              if (message.clientMessageId) {
                actions.resolvePendingMessage(message.clientMessageId, { status: "sent" });
              }
              break;
            case "direct:message":
              actions.receiveDirectMessage(message.message, message.thread);
              if (message.clientMessageId) {
                actions.resolvePendingMessage(message.clientMessageId, { status: "sent" });
              }
              break;
            case "direct:typing":
              set((state) => ({
                typingIndicators: {
                  ...state.typingIndicators,
                  [message.typing.playerId]: message.typing,
                },
              }));
              break;
            case "direct:read":
              set((state) => ({
                pendingReadReceipts: [...state.pendingReadReceipts, message.receipt],
              }));
              break;
            case "presence:sync":
              actions.setOnlinePlayers((message.players ?? []).map(normalizePresencePayload));
              break;
            case "presence:update":
              if (message.player) {
                actions.upsertOnlinePlayer(normalizePresencePayload(message.player));
              }
              break;
            case "error":
              set({
                connectionStatus: "error",
                lastConnectionError: message.message,
              });
              break;
            default:
              console.debug("[realtime] unhandled message", message);
          }
        },
      });

      const httpBaseUrl = normalizeHttpBaseUrl(params.baseUrl);

      set({
        client,
        identity: params.identity,
        baseUrl: httpBaseUrl,
        connectionStatus: "connecting",
        lastConnectionError: undefined,
      });
    },
    resetClient: () => {
      const { client } = get();
      client?.close();
      set({
        ...initialState,
      });
    },
    setConnectionStatus: (status: RealtimeConnectionStatus, errorMessage?: string) => {
      set({
        connectionStatus: status,
        lastConnectionError: errorMessage,
      });
    },
    joinZone: (zoneId: string) => {
      const { client, worldZones } = get();
      if (!worldZones[zoneId]) {
        set({
          worldZones: {
            ...worldZones,
            [zoneId]: createWorldZoneState(zoneId),
          },
        });
      }
      client?.joinZone(zoneId);
    },
    leaveZone: (zoneId: string) => {
      const { client } = get();
      client?.leaveZone(zoneId);
    },
    setActiveZone: (zoneId) => {
      const { worldZones, unreadWorldTotal, activeZoneId } = get();
      if (!zoneId) {
        if (activeZoneId !== undefined) {
          set({ activeZoneId: undefined });
        }
        return;
      }

      const existingZone = worldZones[zoneId];
      if (existingZone && activeZoneId === zoneId && existingZone.unreadCount === 0) {
        return;
      }

      const zoneState = existingZone ?? createWorldZoneState(zoneId);
      const nextWorldZones = {
        ...worldZones,
        [zoneId]: {
          ...zoneState,
          unreadCount: 0,
        },
      };

      const nextUnreadTotal = Math.max(unreadWorldTotal - zoneState.unreadCount, 0);

      set({
        activeZoneId: zoneId,
        worldZones: nextWorldZones,
        unreadWorldTotal: nextUnreadTotal,
      });
    },
    ensureDirectThread: (participantId: string) => {
      const { identity, dmThreads } = get();
      const selfId = identity?.playerId;
      if (!selfId || participantId === selfId) {
        return undefined;
      }

      const participants = [selfId, participantId].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as [string, string];
      const threadId = `${participants[0]}|${participants[1]}`;
      const existingThread = dmThreads[threadId];

      if (existingThread) {
        return threadId;
      }

      const now = new Date().toISOString();
      const threadState = createThreadState({
        id: threadId,
        participants,
        createdAt: now,
        updatedAt: now,
        unreadCounts: {},
      });

      set({
        dmThreads: {
          ...dmThreads,
          [threadId]: threadState,
        },
      });

      return threadId;
    },
    setActiveThread: (threadId) => {
      const { dmThreads, unreadDirectTotal, activeThreadId } = get();
      if (!threadId) {
        if (activeThreadId !== undefined) {
          set({ activeThreadId: undefined });
        }
        return;
      }

      const threadState = dmThreads[threadId];
      if (!threadState) {
        if (activeThreadId !== threadId) {
          set({ activeThreadId: threadId });
        }
        return;
      }

      if (activeThreadId === threadId && threadState.unreadCount === 0) {
        return;
      }

      const unreadCount = threadState.unreadCount;
      const nextUnreadTotal = Math.max(unreadDirectTotal - unreadCount, 0);

      set({
        activeThreadId: threadId,
        dmThreads: {
          ...dmThreads,
          [threadId]: {
            ...threadState,
            unreadCount: 0,
          },
        },
        unreadDirectTotal: nextUnreadTotal,
      });
    },
    receiveWorldMessage: (zoneId, message, options) => {
      const { worldZones, activeZoneId, unreadWorldTotal, identity } = get();
      const zoneState = worldZones[zoneId] ?? createWorldZoneState(zoneId);
      const normalizedMessage = normalizeWorldChatMessage(message);

      const optimisticIndex = options?.clientMessageId
        ? zoneState.messages.findIndex((item) => item.id === options.clientMessageId)
        : -1;
      const serverIdIndex =
        optimisticIndex === -1
          ? zoneState.messages.findIndex((item) => item.id === normalizedMessage.id)
          : -1;
      const replacementIndex = optimisticIndex >= 0 ? optimisticIndex : serverIdIndex;

      const nextMessages =
        replacementIndex >= 0
          ? [
              ...zoneState.messages.slice(0, replacementIndex),
              normalizedMessage,
              ...zoneState.messages.slice(replacementIndex + 1),
            ]
          : [...zoneState.messages, normalizedMessage].slice(-200);

      const pendingMessages = options?.clientMessageId
        ? zoneState.pendingMessages.filter((pending) => pending.id !== options.clientMessageId)
        : zoneState.pendingMessages;

      const isActiveZone = activeZoneId === zoneId;
      const isOwnMessage = identity?.playerId === normalizedMessage.sender.playerId;
      const shouldIncrement = !isActiveZone && !isOwnMessage && replacementIndex === -1;

      const unreadCount = isActiveZone ? 0 : zoneState.unreadCount + (shouldIncrement ? 1 : 0);
      const nextUnreadTotal = shouldIncrement ? unreadWorldTotal + 1 : unreadWorldTotal;

      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...zoneState,
            messages: nextMessages,
            pendingMessages,
            unreadCount,
          },
        },
        unreadWorldTotal: nextUnreadTotal,
      });
    },
    receiveDirectMessage: (message, threadInfo) => {
      const { dmThreads, identity, activeThreadId, unreadDirectTotal } = get();
      const existingThread = dmThreads[message.threadId];
      const baseThread = threadInfo ?? existingThread?.thread ?? createFallbackThread(message);
      const threadState = existingThread ?? createThreadState(baseThread);
      const messages = [...threadState.messages, message].slice(-200);
      const isOwnMessage = identity?.playerId === message.senderId;
      const isActiveThread = activeThreadId === message.threadId;
      const unreadCount = isOwnMessage || isActiveThread ? threadState.unreadCount : threadState.unreadCount + 1;

      const updatedAt =
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : (message.createdAt ?? new Date().toISOString());

      set({
        dmThreads: {
          ...dmThreads,
          [message.threadId]: {
            ...threadState,
            thread: {
              ...baseThread,
              lastMessageId: message.id,
              updatedAt,
            },
            messages,
            unreadCount,
          },
        },
        unreadDirectTotal: isOwnMessage || isActiveThread ? unreadDirectTotal : unreadDirectTotal + 1,
      });
    },
    setWorldHistory: (zoneId, messages, meta) => {
      const { worldZones } = get();
      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...(worldZones[zoneId] ?? createWorldZoneState(zoneId)),
            ...meta,
            messages,
          },
        },
      });
    },
    setDirectHistory: (threadId, messages, meta) => {
      const { dmThreads } = get();
      const thread = dmThreads[threadId];
      if (!thread) return;

      set({
        dmThreads: {
          ...dmThreads,
          [threadId]: {
            ...thread,
            ...meta,
            messages,
          },
        },
      });
    },
    setOnlinePlayers: (players) => {
      const normalized = players.map((player) => ({
        ...player,
        isTypingInThreadIds: player.isTypingInThreadIds ?? [],
      }));
      const next = Object.fromEntries(normalized.map((player) => [player.playerId, player]));
      set({ onlinePlayers: next });
    },
    upsertOnlinePlayer: (player) => {
      const { onlinePlayers } = get();
      const normalized = {
        ...player,
        isTypingInThreadIds: player.isTypingInThreadIds ?? [],
      };
      set({
        onlinePlayers: {
          ...onlinePlayers,
          [normalized.playerId]: {
            ...onlinePlayers[normalized.playerId],
            ...normalized,
            isTypingInThreadIds: normalized.isTypingInThreadIds,
          },
        },
      });
    },
    markZoneAsRead: (zoneId) => {
      const { worldZones, unreadWorldTotal } = get();
      const zoneState = worldZones[zoneId];
      if (!zoneState || zoneState.unreadCount === 0) {
        return;
      }

      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...zoneState,
            unreadCount: 0,
          },
        },
        unreadWorldTotal: Math.max(unreadWorldTotal - zoneState.unreadCount, 0),
      });
    },
    markThreadAsRead: (threadId) => {
      const { dmThreads, unreadDirectTotal } = get();
      const thread = dmThreads[threadId];
      if (!thread || thread.unreadCount === 0) {
        return;
      }

      set({
        dmThreads: {
          ...dmThreads,
          [threadId]: {
            ...thread,
            unreadCount: 0,
          },
        },
        unreadDirectTotal: Math.max(unreadDirectTotal - thread.unreadCount, 0),
      });
    },
    enqueuePendingMessage: (message: PendingMessage) => {
      const { worldZones, dmThreads } = get();
      if (message.zoneId) {
        const zoneState = worldZones[message.zoneId] ?? createWorldZoneState(message.zoneId);
        set({
          worldZones: {
            ...worldZones,
            [message.zoneId]: {
              ...zoneState,
              pendingMessages: [...zoneState.pendingMessages, message],
            },
          },
        });
        return;
      }

      if (message.threadId && dmThreads[message.threadId]) {
        const threadState = dmThreads[message.threadId];
        set({
          dmThreads: {
            ...dmThreads,
            [message.threadId]: {
              ...threadState,
              pendingMessages: [...threadState.pendingMessages, message],
            },
          },
        });
      }
    },
    resolvePendingMessage: (messageId, updates) => {
      const { worldZones, dmThreads } = get();

      const shouldRemove = updates.status === "sent" && !updates.errorMessage;
      const updateList = (list: PendingMessage[]) =>
        shouldRemove
          ? list.filter((pending) => pending.id !== messageId)
          : list.map((pending) => (pending.id === messageId ? { ...pending, ...updates } : pending));

      const nextWorldZones = Object.fromEntries(
        Object.entries(worldZones).map(([zoneId, state]) => [
          zoneId,
          {
            ...state,
            pendingMessages: updateList(state.pendingMessages),
          },
        ]),
      );

      const nextThreads = Object.fromEntries(
        Object.entries(dmThreads).map(([threadId, state]) => [
          threadId,
          {
            ...state,
            pendingMessages: updateList(state.pendingMessages),
          },
        ]),
      );

      set({
        worldZones: nextWorldZones,
        dmThreads: nextThreads,
      });
    },
    sendWorldMessage: async (zoneId, payload) => {
      const { client, identity, worldZones } = get();
      if (!client) return;

      const optimisticId =
        (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const createdAt = new Date().toISOString();

      const optimisticMessage: WorldChatMessage = {
        id: optimisticId,
        zoneId,
        content: payload.content,
        createdAt,
        sender: {
          playerId: identity?.playerId ?? "local-player",
          walletAddress: identity?.walletAddress,
          displayName: identity?.displayName,
          avatarUrl: identity?.avatarUrl,
        },
        location: payload.location,
        metadata: payload.metadata,
      };

      const pending: PendingMessage = {
        id: optimisticId,
        content: payload.content,
        createdAt,
        zoneId,
        status: "sending",
      };

      const existingZone = worldZones[zoneId] ?? createWorldZoneState(zoneId);
      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...existingZone,
            messages: [...existingZone.messages, optimisticMessage].slice(-200),
            pendingMessages: [...existingZone.pendingMessages, pending],
          },
        },
      });

      const message: WorldChatOutboundMessage = {
        type: "world:publish",
        zoneId,
        payload,
        clientMessageId: optimisticId,
      };

      try {
        client.send(message);
      } catch (error) {
        set((state) => {
          const zoneState = state.worldZones[zoneId];
          if (!zoneState) return state;
          return {
            worldZones: {
              ...state.worldZones,
              [zoneId]: {
                ...zoneState,
                pendingMessages: zoneState.pendingMessages.map((item) =>
                  item.id === optimisticId
                    ? { ...item, status: "error", errorMessage: error instanceof Error ? error.message : String(error) }
                    : item,
                ),
              },
            },
          };
        });
      }
    },
    sendDirectMessage: async (threadId, recipientId, content) => {
      const { client } = get();
      if (!client) return;
      const message: DirectMessageOutboundMessage = {
        type: "direct:message",
        payload: {
          threadId,
          recipientId,
          content,
        },
      };
      client.send(message);
    },
    acknowledgeDirectRead: async (receipt: DirectMessageReadReceipt) => {
      const { client } = get();
      if (!client) return;
      client.send({
        type: "direct:read",
        payload: receipt,
      });
    },
    updateTypingState: (payload: DirectMessageTyping) => {
      const { client } = get();
      client?.send({
        type: "direct:typing",
        payload,
      });
      set((state) => ({
        typingIndicators: {
          ...state.typingIndicators,
          [payload.playerId]: payload,
        },
      }));
    },
    setWorldHistoryLoading: (zoneId, isLoading) => {
      const { worldZones } = get();
      const zoneState = worldZones[zoneId] ?? createWorldZoneState(zoneId);
      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...zoneState,
            isFetchingHistory: isLoading,
          },
        },
      });
    },
    setDirectHistoryLoading: (threadId, isLoading) => {
      const { dmThreads } = get();
      const threadState = dmThreads[threadId];
      if (!threadState) return;
      set({
        dmThreads: {
          ...dmThreads,
          [threadId]: {
            ...threadState,
            isFetchingHistory: isLoading,
          },
        },
      });
    },
    loadWorldHistory: async ({ zoneId, cursor, limit, since, replaceExisting }: LoadWorldChatHistoryParams) => {
      const { baseUrl, identity } = get();
      if (!baseUrl) return;

      set((state) => {
        const zoneState = state.worldZones[zoneId] ?? createWorldZoneState(zoneId);
        return {
          worldZones: {
            ...state.worldZones,
            [zoneId]: {
              ...zoneState,
              isFetchingHistory: true,
            },
          },
        };
      });

      try {
        const url = new URL("/api/chat/world", baseUrl);
        url.searchParams.set("zoneId", zoneId);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (limit) url.searchParams.set("limit", String(limit));
        if (since) {
          const sinceValue = since instanceof Date ? since.toISOString() : since;
          url.searchParams.set("since", sinceValue);
        }

        const headers: Record<string, string> = {};
        if (identity?.playerId) {
          headers["x-player-id"] = identity.playerId;
        }
        if (identity?.walletAddress) {
          headers["x-wallet-address"] = identity.walletAddress;
        }
        if (identity?.displayName) {
          headers["x-player-name"] = identity.displayName;
        }

        const response = await fetch(url.toString(), { headers });

        if (!response.ok) {
          throw new Error(`Failed to load world chat history (${response.status})`);
        }

        const data = await response.json();
        const incoming = Array.isArray(data?.messages)
          ? (data.messages as any[]).map((record) => mapWorldChatRecordToMessage(record, zoneId))
          : [];

        incoming.sort((a, b) => {
          const aTime = new Date(a.createdAt as string).getTime();
          const bTime = new Date(b.createdAt as string).getTime();
          return aTime - bTime;
        });

        set((state) => {
          const currentZone = state.worldZones[zoneId] ?? createWorldZoneState(zoneId);
          const existingMessages = replaceExisting ? [] : currentZone.messages;
          const existingIds = new Set(existingMessages.map((msg) => msg.id));
          const dedupedIncoming = replaceExisting ? incoming : incoming.filter((msg) => !existingIds.has(msg.id));
          const combined = replaceExisting ? incoming : [...dedupedIncoming, ...existingMessages];

          return {
            worldZones: {
              ...state.worldZones,
              [zoneId]: {
                ...currentZone,
                messages: combined,
                hasMoreHistory: Boolean(data?.nextCursor),
                lastFetchedCursor: data?.nextCursor ?? null,
                isFetchingHistory: false,
              },
            },
          };
        });
      } catch (error) {
        console.error("Failed to load world chat history", error);
        set((state) => {
          const currentZone = state.worldZones[zoneId] ?? createWorldZoneState(zoneId);
          return {
            worldZones: {
              ...state.worldZones,
              [zoneId]: {
                ...currentZone,
                isFetchingHistory: false,
              },
            },
          };
        });
      }
    },
    loadDirectHistory: async (_threadId: string, _cursor?: string) => {
      // Placeholder: HTTP integration to be implemented.
    },
  },
}));
