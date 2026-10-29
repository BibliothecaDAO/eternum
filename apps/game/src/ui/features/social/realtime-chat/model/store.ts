import { create } from "zustand";
import { toast } from "@/ui/features/event-feed/notify";

import { AudioManager } from "@/audio/core/AudioManager";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import { GLOBAL_CHAT_CHANNEL_ID, RealtimeClient } from "@bibliothecadao/types";
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
  PlayerPresence,
  RealtimeChatStore,
  RealtimeConnectionStatus,
  WorldChatMessage,
  WorldChatOutboundMessage,
  WorldChatZoneState,
} from "./types";
import { fetchApi } from "@/runtime/app-api";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { receiptDue } from "./direct-unread";

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
  hasMoreHistory: true,
  lastFetchedCursor: undefined,
  isFetchingHistory: false,
  pendingMessages: [],
});

const timeOf = (value: string | Date | null | undefined) => (value ? new Date(value).getTime() : 0);

/** A conversation's lines with others added: each once, in time order. */
const mergeLines = (held: DirectMessage[], incoming: DirectMessage[]): DirectMessage[] => {
  const heldIds = new Set(held.map((line) => line.id));
  const added = incoming.filter((line) => !heldIds.has(line.id));
  return added.length ? [...held, ...added].toSorted((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt)) : held;
};

const toIsoTimestamp = (value: string | Date | null | undefined): string => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizePresencePayload = (presence: PlayerPresence): PlayerPresence => ({
  playerId: presence.playerId,
  displayName: presence.displayName ?? null,
  isOnline: Boolean(presence.isOnline),
  isTypingInThreadIds: presence.isTypingInThreadIds ?? [],
});

const createFallbackThread = (message: DirectMessage): DirectMessageThread => {
  const createdAt = toIsoTimestamp(message.createdAt as string | Date | undefined);
  const participants = [message.senderId, message.recipientId].toSorted() as [string, string];
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
      displayName: record.sender?.displayName ?? record.senderDisplayName ?? undefined,
      avatarUrl: record.sender?.avatarUrl ?? record.senderAvatarUrl ?? undefined,
    },
  });

const normalizeDirectMessage = (message: DirectMessage): DirectMessage => ({
  ...message,
  createdAt: toIsoTimestamp(message.createdAt as string | Date | undefined),
  metadata: message.metadata ?? undefined,
});

const mapDirectMessageRecord = (record: any): DirectMessage =>
  normalizeDirectMessage({
    id: record.id,
    threadId: record.threadId,
    senderId: record.senderId,
    recipientId: record.recipientId,
    content: record.content,
    metadata: record.metadata ?? undefined,
    createdAt: record.createdAt ?? new Date().toISOString(),
  });

const mapDirectThreadRecord = (record: any): DirectMessageThread => {
  if (!record) {
    throw new Error("Invalid direct message thread record");
  }

  let participants: [string, string] | undefined;
  if (Array.isArray(record.participants) && record.participants.length === 2) {
    participants = [record.participants[0], record.participants[1]];
  } else if (typeof record.playerAId === "string" && typeof record.playerBId === "string") {
    participants = [record.playerAId, record.playerBId];
  } else if (typeof record.id === "string" && record.id.includes("|")) {
    const [first, second] = record.id.split("|");
    if (first && second) {
      participants = [first, second];
    }
  }

  if (!participants) {
    throw new Error("Unable to resolve thread participants");
  }

  const sortedParticipants = participants.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as [string, string];

  const createdAt = toIsoTimestamp(record.createdAt ?? record.lastMessageAt ?? new Date().toISOString());
  const updatedAtValue = record.updatedAt ?? record.lastMessageAt ?? null;
  const updatedAt = updatedAtValue ? toIsoTimestamp(updatedAtValue) : undefined;

  return {
    id: record.id ?? sortedParticipants.join("|"),
    participants: sortedParticipants,
    createdAt,
    updatedAt,
    lastMessageId: record.lastMessageId ?? undefined,
    unreadCounts: record.unreadCounts ?? {},
  };
};

const matchesIdentityAlias = (identity: { playerId: string } | undefined, candidate: string | null | undefined) => {
  if (!identity || !candidate) {
    return false;
  }
  if (identity.playerId === candidate) {
    return true;
  }
  return false;
};

const initialState: Omit<RealtimeChatStore, "actions"> = {
  client: null,
  connectionStatus: "idle",
  joinedZoneIds: [],
  lastConnectionError: undefined,
  identity: undefined,
  baseUrl: undefined,
  activeZoneId: undefined,
  activeThreadId: undefined,
  isShellOpen: false,
  worldZones: {},
  dmThreads: {},
  unreadWorldTotal: 0,
  onlinePlayers: {},
  typingIndicators: {},
  pendingReadReceipts: [],
  view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
  blockedPlayers: null,
  heldWorldMessages: [],
  rooms: [],
  readOnlyZoneIds: [],
  roomRefusals: {},
};

/** The signed-in account's block list, as the server returns it after a read or a change. */
const requestBlockList = async (baseUrl: string | undefined, method: string, path = "", body?: unknown) => {
  if (!baseUrl) return null;
  const response = await fetchApi(new URL(`/api/chat/blocks${path}`, baseUrl), {
    method,
    credentials: "include",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Block list request failed (${response.status})`);
  return ((await response.json()) as { blocked: string[] }).blocked;
};

/** The first wait before the block list is read again after a failed read; each further one doubles, up to a minute. */
const MUTES_RETRY_MS = 2_000;

export const useRealtimeChatStore = create<RealtimeChatStore>((set, get) => ({
  ...initialState,
  actions: {
    initializeClient: (params: InitializeRealtimeClientParams) => {
      const { client: existingClient } = get();
      existingClient?.close();

      const client = new RealtimeClient({
        baseUrl: params.baseUrl,
        rooms: params.rooms,
        // The inbox's own events. The rooms the player is in are each room's to say (joined:zone, left:zone): the inbox
        // dropping or coming back leaves a room whose socket stands as it is.
        onOpen: () => {
          if (get().client !== client) return;
          set({ connectionStatus: "connecting", lastConnectionError: undefined });
        },
        onClose: (event) => {
          if (get().client !== client) return;
          set({
            connectionStatus: event.wasClean ? "idle" : "error",
            lastConnectionError: event.reason || undefined,
          });
        },
        onError: (event) => {
          if (get().client !== client) return;
          set({
            connectionStatus: "error",
            lastConnectionError: event instanceof Event ? event.type : String(event),
          });
        },
        // Told after the drop itself: the status a player reads is that chat is coming back, not that it failed.
        onReconnecting: () => {
          if (get().client === client) set({ connectionStatus: "reconnecting" });
        },
        onMessage: (message) => {
          if (get().client !== client) return;
          const { actions } = get();

          switch (message.type) {
            case "connected":
              // The transport opens the player's rooms the server allows; each says it is joined when it opens.
              set({
                connectionStatus: "connected",
                identity: {
                  playerId: message.playerId as string,
                  displayName: (message.displayName as string | null | undefined) ?? undefined,
                },
              });
              // The inbox's handshake (a reconnect's too) lists the conversations, those that came while away with them.
              if (Array.isArray(message.threads)) {
                const listed = message.threads as { thread: unknown; lastMessage: unknown }[];
                set((state) => {
                  // A new connection tells its reads again: one sent on the connection before may have been lost.
                  const dmThreads = Object.fromEntries(
                    Object.entries(state.dmThreads).map(([id, held]) => [id, { ...held, receiptSent: undefined }]),
                  );
                  for (const record of listed) {
                    const thread = mapDirectThreadRecord(record.thread);
                    const held = dmThreads[thread.id] ?? createThreadState(thread);
                    const last = record.lastMessage ? [mapDirectMessageRecord(record.lastMessage)] : [];
                    dmThreads[thread.id] = { ...held, thread, messages: mergeLines(held.messages, last) };
                  }
                  return { dmThreads };
                });
              }
              break;
            case "joined:zone":
              set((state) => ({
                joinedZoneIds: [...new Set([...state.joinedZoneIds, message.zoneId as string])],
                // The room says at its open whether the player writes there.
                readOnlyZoneIds:
                  message.canWrite === false
                    ? [...new Set([...state.readOnlyZoneIds, message.zoneId as string])]
                    : state.readOnlyZoneIds.filter((zoneId) => zoneId !== message.zoneId),
                // A room that dropped and came back ends the reconnecting it started.
                connectionStatus: state.connectionStatus === "reconnecting" ? "connected" : state.connectionStatus,
              }));
              actions.joinZone(message.zoneId as string);
              break;
            case "left:zone":
              set((state) => ({ joinedZoneIds: state.joinedZoneIds.filter((zoneId) => zoneId !== message.zoneId) }));
              break;
            case "world:message":
              // A room the player does not have counts nothing: nothing it says reaches the player.
              if (!get().joinedZoneIds.includes(message.zoneId as string)) break;
              actions.receiveWorldMessage(message.zoneId as string, message.message as WorldChatMessage, {
                clientMessageId: message.clientMessageId as string | undefined,
              });
              if (message.clientMessageId) {
                actions.resolvePendingMessage(message.clientMessageId as string, { status: "sent" });
              }
              break;
            case "direct:message":
              actions.receiveDirectMessage(message.message as DirectMessage, message.thread as DirectMessageThread);
              if (message.clientMessageId) {
                actions.resolvePendingMessage(message.clientMessageId as string, { status: "sent" });
              }
              break;
            case "direct:thread": {
              // Read on one of the player's devices: every device takes the thread with its unread recounted.
              const thread = mapDirectThreadRecord(message.thread);
              set((state) => ({
                dmThreads: {
                  ...state.dmThreads,
                  [thread.id]: { ...(state.dmThreads[thread.id] ?? createThreadState(thread)), thread },
                },
              }));
              break;
            }
            case "direct:typing":
              set((state) => ({
                typingIndicators: {
                  ...state.typingIndicators,
                  [(message.typing as DirectMessageTyping).playerId]: message.typing as DirectMessageTyping,
                },
              }));
              break;
            case "direct:read":
              set((state) => ({
                pendingReadReceipts: [...state.pendingReadReceipts, message.receipt as DirectMessageReadReceipt],
              }));
              break;
            case "presence:sync":
              actions.setOnlinePlayers((message.players as PlayerPresence[]).map(normalizePresencePayload));
              break;
            case "presence:update":
              if (message.player) {
                actions.upsertOnlinePlayer(normalizePresencePayload(message.player as PlayerPresence));
              }
              break;
            case "presence:remove":
              set((state) => ({
                onlinePlayers: Object.fromEntries(
                  Object.entries(state.onlinePlayers).filter(([playerId]) => playerId !== message.playerId),
                ),
              }));
              break;
            case "error":
              // A room's refusal of the player's message is that room's (its last message not taken), not the
              // connection's; a refusal for want of registration means the player only reads there now.
              if (typeof message.zoneId === "string") actions.refuseInRoom(message.zoneId, message.code as string);
              else
                set({
                  connectionStatus: "error",
                  lastConnectionError: message.message as string | undefined,
                });
              break;
            default:
              if (VERBOSE_LOGS_ENABLED) console.debug("[realtime] unhandled message", message);
          }
        },
      });

      const httpBaseUrl = normalizeHttpBaseUrl(params.baseUrl);

      set({
        client,
        rooms: [...params.rooms],
        identity: undefined,
        baseUrl: httpBaseUrl,
        connectionStatus: "connecting",
        joinedZoneIds: [],
        lastConnectionError: undefined,
        blockedPlayers: null,
        heldWorldMessages: [],
      });
      // Who is muted is read before any room message is shown, counted or heard. A failed read is told once and tried
      // again, later each time, for as long as this connection stands.
      const readMutes = (attempt: number): Promise<void> =>
        get()
          .actions.loadBlockedPlayers()
          .catch((error: unknown) => {
            if (get().client !== client) return;
            if (attempt === 0) toast.failed(error, CHAT_WORDS.mutesUnavailable);
            setTimeout(
              () => {
                if (get().client === client && get().blockedPlayers === null) void readMutes(attempt + 1);
              },
              Math.min(MUTES_RETRY_MS * 2 ** attempt, 60_000),
            );
          });
      void readMutes(0);
    },
    setRooms: (rooms) => {
      const before = get().rooms;
      if (before.length === rooms.length && before.every((zoneId, at) => zoneId === rooms[at])) return;
      set({ rooms: [...rooms] });
      get().client?.setRooms(rooms);
    },
    reopenRoom: (zoneId) => get().client?.reopenZone(zoneId),
    refuseInRoom: (zoneId, code) => {
      const zone = get().worldZones[zoneId];
      // The room answers in order: the refused message is the oldest still being sent there.
      const refused = zone?.pendingMessages.find((pending) => pending.status === "sending");
      set((state) => ({
        ...(code === "registration_required"
          ? { readOnlyZoneIds: [...new Set([...state.readOnlyZoneIds, zoneId])] }
          : {
              roomRefusals: { ...state.roomRefusals, [zoneId]: code === "rate_limited" ? "rate-limited" : "refused" },
            }),
        ...(zone && refused
          ? {
              worldZones: {
                ...state.worldZones,
                [zoneId]: {
                  ...zone,
                  messages: zone.messages.filter((line) => line.id !== refused.id),
                  pendingMessages: zone.pendingMessages.filter((pending) => pending.id !== refused.id),
                },
              },
            }
          : {}),
      }));
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
      const { joinedZoneIds, worldZones } = get();
      if (!joinedZoneIds.includes(zoneId)) return;
      if (!worldZones[zoneId]) {
        set({
          worldZones: {
            ...worldZones,
            [zoneId]: createWorldZoneState(zoneId),
          },
        });
      }
    },
    // Each view is read where it stands: the room shown counts nothing unread, a conversation open neither; leaving one
    // lets its messages count again.
    showRoom: (zoneId) => {
      const { actions } = get();
      actions.joinZone(zoneId);
      actions.setActiveThread(undefined);
      actions.setActiveZone(zoneId);
      set({ view: { kind: "room", zoneId } });
    },
    showMessages: () => {
      const { actions } = get();
      actions.setActiveZone(undefined);
      actions.setActiveThread(undefined);
      set({ view: { kind: "messages" } });
    },
    openConversation: (playerId) => {
      const { actions } = get();
      const threadId = actions.ensureDirectThread(playerId);
      if (!threadId) return;
      actions.setActiveZone(undefined);
      actions.setActiveThread(threadId);
      set({ view: { kind: "conversation", threadId } });
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
    setShellOpen: (isOpen) => {
      const { isShellOpen } = get();
      if (isShellOpen === isOpen) {
        return;
      }
      set({ isShellOpen: isOpen });
    },
    ensureDirectThread: (participantId: string) => {
      const { identity, dmThreads } = get();
      const selfId = identity?.playerId;
      if (!selfId) {
        return undefined;
      }

      const selfAliases = new Set<string>([selfId]);

      if (selfAliases.has(participantId)) {
        return undefined;
      }

      const existingAliasThread = Object.entries(dmThreads).find(([, state]) => {
        const participants = new Set(state.thread.participants);
        const includesParticipant = participants.has(participantId);
        const includesSelf = Array.from(selfAliases).some((alias) => participants.has(alias));
        return includesParticipant && includesSelf;
      });

      if (existingAliasThread) {
        return existingAliasThread[0];
      }

      const participants = [selfId, participantId].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as [string, string];
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
      if (get().activeThreadId !== threadId) set({ activeThreadId: threadId });
    },
    receiveWorldMessage: (zoneId, message, options) => {
      const { worldZones, activeZoneId, unreadWorldTotal, identity, isShellOpen, blockedPlayers } = get();
      if (blockedPlayers === null) {
        set((state) => ({
          heldWorldMessages: [
            ...state.heldWorldMessages,
            { zoneId, message, clientMessageId: options?.clientMessageId },
          ],
        }));
        return;
      }
      const zoneState = worldZones[zoneId] ?? createWorldZoneState(zoneId);
      const normalizedMessage = normalizeWorldChatMessage(message);

      const optimisticIndex = options?.clientMessageId
        ? zoneState.messages.findIndex((item) => item.id === options.clientMessageId)
        : -1;
      const serverIdIndex =
        optimisticIndex === -1 ? zoneState.messages.findIndex((item) => item.id === normalizedMessage.id) : -1;
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
      const isOwnMessage = matchesIdentityAlias(identity, normalizedMessage.sender.playerId);
      // A muted player's message is kept, as the room has it, but neither heard nor counted.
      const isMuted = blockedPlayers.includes(normalizedMessage.sender.playerId);
      const shouldIncrement = !isOwnMessage && !isMuted && replacementIndex === -1 && (!isShellOpen || !isActiveZone);

      if (shouldIncrement) {
        AudioManager.getInstance().play("ui.msg_receive");
      }

      const unreadCount = isShellOpen && isActiveZone ? 0 : zoneState.unreadCount + (shouldIncrement ? 1 : 0);
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
      const { dmThreads, identity, activeThreadId, isShellOpen } = get();
      const normalizedMessage = normalizeDirectMessage(message);
      const existingThread = dmThreads[normalizedMessage.threadId];
      const baseThread = threadInfo ?? existingThread?.thread ?? createFallbackThread(normalizedMessage);
      const threadState = existingThread ?? createThreadState(baseThread);
      const messages = [...threadState.messages, normalizedMessage].slice(-200);
      const isOwnMessage = matchesIdentityAlias(identity, normalizedMessage.senderId);
      const isActiveThread = activeThreadId === normalizedMessage.threadId;
      // Heard and shown when it is not being read; what it adds to unread is the server's count, in its thread.
      if (!isOwnMessage && (!isShellOpen || !isActiveThread)) {
        AudioManager.getInstance().play("ui.msg_receive");
        const { onlinePlayers } = get();
        const senderName =
          onlinePlayers[normalizedMessage.senderId]?.displayName ?? normalizedMessage.senderId.slice(0, 8);
        const preview = normalizedMessage.content.slice(0, 60);
        toast(`${senderName}: ${preview}`);
      }

      const updatedAt =
        normalizedMessage.createdAt instanceof Date
          ? normalizedMessage.createdAt.toISOString()
          : (normalizedMessage.createdAt ?? new Date().toISOString());

      set({
        dmThreads: {
          ...dmThreads,
          [normalizedMessage.threadId]: {
            ...threadState,
            thread: {
              ...baseThread,
              lastMessageId: normalizedMessage.id,
              updatedAt,
            },
            messages,
          },
        },
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
    // Read here, and told to the server when a receipt is due (receiptDue): it recounts its unread and tells every
    // device of the player.
    markThreadAsRead: (threadId) => {
      const state = get();
      const due = receiptDue(state, threadId);
      if (!due || !state.identity) return;
      set({ dmThreads: { ...state.dmThreads, [threadId]: { ...state.dmThreads[threadId]!, receiptSent: due.id } } });
      void state.actions.acknowledgeDirectRead({
        threadId,
        messageId: due.id,
        readerId: state.identity.playerId,
        readAt: new Date().toISOString(),
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
      const { client, identity, worldZones, joinedZoneIds } = get();
      if (!client || !joinedZoneIds.includes(zoneId)) return;

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
          displayName: identity?.displayName,
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
      // A new message puts the room's last refusal away.
      const roomRefusals = { ...get().roomRefusals };
      delete roomRefusals[zoneId];
      set({
        worldZones: {
          ...worldZones,
          [zoneId]: {
            ...existingZone,
            messages: [...existingZone.messages, optimisticMessage].slice(-200),
            pendingMessages: [...existingZone.pendingMessages, pending],
          },
        },
        roomRefusals,
      });

      const message: WorldChatOutboundMessage = {
        type: "world:publish",
        zoneId,
        payload,
        clientMessageId: optimisticId,
      };

      try {
        client.send(message);
        AudioManager.getInstance().play("ui.msg_send");
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
    sendDirectMessage: async (threadId, recipientId, content, metadata) => {
      const { client } = get();
      if (!client) return;
      const message: DirectMessageOutboundMessage = {
        type: "direct:message",
        payload: {
          threadId,
          recipientId,
          content,
          ...(metadata ? { metadata } : {}),
        },
      };
      client.send(message);
      AudioManager.getInstance().play("ui.msg_send");
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
      const { baseUrl, joinedZoneIds } = get();
      if (!baseUrl || !joinedZoneIds.includes(zoneId) || get().worldZones[zoneId]?.isFetchingHistory) return;

      set((state) => {
        const zoneState = state.worldZones[zoneId] ?? createWorldZoneState(zoneId);
        return {
          worldZones: {
            ...state.worldZones,
            [zoneId]: {
              ...zoneState,
              isFetchingHistory: true,
              historyError: undefined,
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

        const response = await fetchApi(url.toString(), { credentials: "include" });

        if (!response.ok) {
          throw new Error(`Failed to load world chat history (${response.status})`);
        }

        const data = await response.json();
        const incomingUnsorted = Array.isArray(data?.messages)
          ? (data.messages as any[]).map((record) => mapWorldChatRecordToMessage(record, zoneId))
          : [];

        const incoming = incomingUnsorted.toSorted((a, b) => {
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
                historyError: undefined,
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
                historyError: "Chat history is unavailable. Try again.",
              },
            },
          };
        });
      }
    },
    loadDirectHistory: async (threadId: string, cursor?: string) => {
      const { baseUrl, client } = get();
      if (!baseUrl || get().dmThreads[threadId]?.isFetchingHistory) return;

      set((state) => {
        const existing = state.dmThreads[threadId];
        if (!existing) {
          return state;
        }
        return {
          dmThreads: {
            ...state.dmThreads,
            [threadId]: {
              ...existing,
              isFetchingHistory: true,
            },
          },
        };
      });

      try {
        const url = new URL(`/api/chat/dm/threads/${threadId}/messages`, baseUrl);
        url.searchParams.set("limit", "50");
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetchApi(url.toString(), { credentials: "include" });

        if (!response.ok) {
          // Handle 404 gracefully - new threads don't have history yet
          if (response.status === 404) {
            set((state) => {
              const existing = state.dmThreads[threadId];
              if (!existing) return state;
              return {
                dmThreads: {
                  ...state.dmThreads,
                  [threadId]: {
                    ...existing,
                    hasMoreHistory: false,
                    isFetchingHistory: false,
                  },
                },
              };
            });
            return;
          }
          throw new Error(`Failed to load direct chat history (${response.status})`);
        }

        const data = await response.json();
        // A page read for a client replaced since writes nothing into the one that replaced it.
        if (get().client !== client) return;
        const incoming = Array.isArray(data?.messages)
          ? (data.messages as any[]).map((record) => mapDirectMessageRecord(record))
          : [];

        set((state) => {
          const existing = state.dmThreads[threadId];
          const baseThread = existing?.thread ?? (incoming[0] ? createFallbackThread(incoming[0]) : undefined);

          if (!baseThread) {
            if (!existing) {
              return state;
            }
            return {
              dmThreads: {
                ...state.dmThreads,
                [threadId]: {
                  ...existing,
                  isFetchingHistory: false,
                },
              },
            };
          }

          const threadState = existing ?? createThreadState(baseThread);

          return {
            dmThreads: {
              ...state.dmThreads,
              [threadId]: {
                ...threadState,
                messages: mergeLines(threadState.messages, incoming),
                hasMoreHistory: Boolean(data?.nextCursor),
                lastFetchedCursor: data?.nextCursor ?? null,
                isFetchingHistory: false,
              },
            },
          };
        });
      } catch (error) {
        console.error("Failed to load direct chat history", error);
        set((state) => {
          const existing = state.dmThreads[threadId];
          if (!existing) return state;
          return {
            dmThreads: {
              ...state.dmThreads,
              [threadId]: {
                ...existing,
                isFetchingHistory: false,
              },
            },
          };
        });
      }
    },
    loadBlockedPlayers: async () => {
      const blocked = await requestBlockList(get().baseUrl, "GET");
      if (blocked) knowMutes(blocked);
    },
    // Blocking hides the thread: the chat leaves it for Messages, which lists the muted players (from the block list,
    // so after a reload too), and its messages leave this client. The server drops the account's future messages;
    // unblocking lets later ones through and brings the conversation back, its history read again.
    blockPlayer: async (playerId) => {
      const blocked = await requestBlockList(get().baseUrl, "POST", "", { realmsId: playerId });
      if (!blocked) return;
      const hidden = Object.keys(get().dmThreads).filter((threadId) =>
        get().dmThreads[threadId]!.thread.participants.includes(playerId),
      );
      const dmThreads = Object.fromEntries(
        Object.entries(get().dmThreads).filter(([threadId]) => !hidden.includes(threadId)),
      );
      const { view } = get();
      const showing = view.kind === "conversation" && hidden.includes(view.threadId);
      set({ dmThreads, ...(showing ? { view: { kind: "messages" as const } } : {}) });
      knowMutes(blocked);
    },
    unblockPlayer: async (playerId) => {
      const blocked = await requestBlockList(get().baseUrl, "DELETE", `/${encodeURIComponent(playerId)}`);
      if (!blocked) return;
      knowMutes(blocked);
      const threadId = get().actions.ensureDirectThread(playerId);
      if (threadId) await get().actions.loadDirectHistory(threadId);
    },
  },
}));

/** The server's block list, now known: every room message held for it is taken, as it would have been on arrival. */
const knowMutes = (blocked: string[]) => {
  const held = useRealtimeChatStore.getState().heldWorldMessages;
  useRealtimeChatStore.setState({ blockedPlayers: blocked, heldWorldMessages: [] });
  for (const { zoneId, message, clientMessageId } of held)
    useRealtimeChatStore.getState().actions.receiveWorldMessage(zoneId, message, { clientMessageId });
};
