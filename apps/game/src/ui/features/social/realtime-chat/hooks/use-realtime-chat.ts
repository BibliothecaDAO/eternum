import { useLatest } from "@/hooks/use-latest";
import { useCallback, useEffect, useMemo } from "react";

import { useRealtimeChatStore } from "../model/store";
import type {
  InitializeRealtimeClientParams,
  PlayerPresence,
  RealtimeChatActions,
  RealtimeChatState,
  WorldChatPublishPayload,
} from "../model/types";

type StoreSelector<T> = (state: RealtimeChatState & { actions: RealtimeChatActions }) => T;

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

  const loadHistory = useCallback(
    (cursor?: string) => {
      if (!zoneId) return Promise.resolve();
      return actions.loadWorldHistory({ zoneId, cursor, limit: 10 });
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
  // The client starts again only for another server or other zones, with the config as it stands then.
  const startedWith = useLatest(config);
  const clientKey = config ? `${config.baseUrl} ${JSON.stringify(config.joinZones ?? [])}` : null;

  useEffect(() => {
    const current = startedWith.current;
    if (!clientKey || !current) return;
    actions.initializeClient(current);
    return () => {
      actions.resetClient();
    };
  }, [actions, clientKey, startedWith]);
};

export const useRealtimeChatSelector = <T>(
  selector: StoreSelector<T>,
  // equalityFn?: (previous: T, next: T) => boolean,
): T => useRealtimeChatStore(selector);
