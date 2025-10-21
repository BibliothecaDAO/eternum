import { useCallback, useEffect, useMemo } from "react";

import { useRealtimeChatStore } from "../model/store";
import type {
  DirectMessage,
  InitializeRealtimeClientParams,
  PendingMessage,
  PlayerPresence,
  RealtimeChatActions,
  RealtimeChatState,
  WorldChatPublishPayload,
} from "../model/types";

type StoreSelector<T> = (state: RealtimeChatState & { actions: RealtimeChatActions }) => T;

const toTimestamp = (value: string | Date | undefined): number => {
  if (!value) return 0;
  return typeof value === "string" ? Date.parse(value) : value.getTime();
};

export const useRealtimeChatActions = () => useRealtimeChatStore((state) => state.actions);

export const useRealtimeConnection = () => {
  const connectionStatus = useRealtimeChatStore((state) => state.connectionStatus);
  const client = useRealtimeChatStore((state) => state.client);
  const identity = useRealtimeChatStore((state) => state.identity);
  const lastConnectionError = useRealtimeChatStore((state) => state.lastConnectionError);

  return useMemo(
    () => ({
      connectionStatus,
      client,
      identity,
      lastConnectionError,
    }),
    [connectionStatus, client, identity, lastConnectionError],
  );
};

export const useRealtimeTotals = () => {
  const unreadWorldTotal = useRealtimeChatStore((state) => state.unreadWorldTotal);
  const unreadDirectTotal = useRealtimeChatStore((state) => state.unreadDirectTotal);

  return useMemo(
    () => ({
      unreadWorldTotal,
      unreadDirectTotal,
    }),
    [unreadWorldTotal, unreadDirectTotal],
  );
};

export const useRealtimePresence = (): PlayerPresence[] => {
  const onlinePlayers = useRealtimeChatStore((state) => state.onlinePlayers);

  return useMemo(() => Object.values(onlinePlayers), [onlinePlayers]);
};

export const useRealtimeTypingIndicators = () => useRealtimeChatStore((state) => state.typingIndicators);

export const useRealtimePendingMessages = () => {
  const worldZones = useRealtimeChatStore((state) => state.worldZones);
  const dmThreads = useRealtimeChatStore((state) => state.dmThreads);

  return useMemo(() => {
    const zonePending = Object.values(worldZones).flatMap(({ pendingMessages }) => pendingMessages);
    const directPending = Object.values(dmThreads).flatMap(({ pendingMessages }) => pendingMessages);
    return [...zonePending, ...directPending];
  }, [worldZones, dmThreads]);
};

export const useRealtimeWorldZone = (zoneId?: string) => {
  const zone = useRealtimeChatStore((state) => (zoneId ? state.worldZones[zoneId] : undefined));
  const isActive = useRealtimeChatStore((state) => state.activeZoneId === zoneId);

  return useMemo(
    () => ({
      zone,
      isActive,
    }),
    [zone, isActive],
  );
};

export const useWorldChatControls = (zoneId?: string) => {
  const actions = useRealtimeChatActions();

  const sendMessage = useCallback(
    (payload: WorldChatPublishPayload) => {
      if (!zoneId) return Promise.resolve();
      return actions.sendWorldMessage(zoneId, payload);
    },
    [actions, zoneId],
  );

  const setActive = useCallback(() => {
    if (zoneId) {
      actions.setActiveZone(zoneId);
    }
  }, [actions, zoneId]);

  const loadHistory = useCallback(
    (cursor?: string) => {
      if (!zoneId) return Promise.resolve();
      return actions.loadWorldHistory({ zoneId, cursor });
    },
    [actions, zoneId],
  );

  const markAsRead = useCallback(() => {
    if (zoneId) {
      actions.markZoneAsRead(zoneId);
    }
  }, [actions, zoneId]);

  return {
    sendMessage,
    setActive,
    loadHistory,
    markAsRead,
  };
};

export const useDirectThread = (threadId?: string) => {
  const thread = useRealtimeChatStore((state) => (threadId ? state.dmThreads[threadId] : undefined));
  const isActive = useRealtimeChatStore((state) => state.activeThreadId === threadId);

  return useMemo(
    () => ({
      thread,
      isActive,
    }),
    [thread, isActive],
  );
};

export const useDirectMessageControls = (threadId?: string, recipientId?: string) => {
  const actions = useRealtimeChatActions();

  const sendMessage = useCallback(
    (content: string) => {
      if (!recipientId) return Promise.resolve();
      return actions.sendDirectMessage(threadId, recipientId, content);
    },
    [actions, recipientId, threadId],
  );

  const loadHistory = useCallback(
    (cursor?: string) => {
      if (!threadId) return Promise.resolve();
      return actions.loadDirectHistory(threadId, cursor);
    },
    [actions, threadId],
  );

  const markAsRead = useCallback(() => {
    if (threadId) {
      actions.markThreadAsRead(threadId);
    }
  }, [actions, threadId]);

  return {
    sendMessage,
    loadHistory,
    markAsRead,
  };
};

export const useRealtimeChatInitializer = (config?: InitializeRealtimeClientParams | null) => {
  const actions = useRealtimeChatActions();

  useEffect(() => {
    if (!config) return;
    actions.initializeClient(config);
    return () => {
      actions.resetClient();
    };
  }, [
    actions,
    config?.baseUrl,
    config?.identity.playerId,
    config?.identity.displayName,
    config?.identity.walletAddress,
    config?.identity.avatarUrl,
    JSON.stringify(config?.queryParams ?? {}),
    JSON.stringify(config?.joinZones ?? []),
  ]);
};

export const useRealtimeChatSelector = <T>(
  selector: StoreSelector<T>,
  // equalityFn?: (previous: T, next: T) => boolean,
): T => useRealtimeChatStore(selector);

export const useRealtimePendingMessageById = (messageId: string): PendingMessage | undefined =>
  useRealtimeChatStore((state) => {
    for (const zone of Object.values(state.worldZones)) {
      const match = zone.pendingMessages.find((pending) => pending.id === messageId);
      if (match) return match;
    }
    for (const thread of Object.values(state.dmThreads)) {
      const match = thread.pendingMessages.find((pending) => pending.id === messageId);
      if (match) return match;
    }
    return undefined;
  });

export const useRealtimeRecentMessages = (limit = 10): DirectMessage[] => {
  const dmThreads = useRealtimeChatStore((state) => state.dmThreads);

  return useMemo(() => {
    const messages = Object.values(dmThreads).flatMap(({ messages }) => messages);

    return [...messages]
      .sort((a, b) => {
        const aTime = toTimestamp(a.createdAt as string | Date | undefined);
        const bTime = toTimestamp(b.createdAt as string | Date | undefined);
        return bTime - aTime;
      })
      .slice(0, limit);
  }, [dmThreads, limit]);
};
