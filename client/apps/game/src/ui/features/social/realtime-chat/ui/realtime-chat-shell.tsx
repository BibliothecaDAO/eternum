import { ReactNode, useEffect } from "react";

import {
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeConnection,
  useRealtimeTotals,
} from "../hooks/use-realtime-chat";
import type { InitializeRealtimeClientParams, PlayerPresence } from "../model/types";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { ThreadListPanel } from "./direct-messages/thread-list-panel";
import { PresenceSidebar } from "./shared/presence-sidebar";
import { WorldChatPanel } from "./world-chat/world-chat-panel";

export interface RealtimeChatShellProps {
  initializer?: InitializeRealtimeClientParams | null;
  zoneIds?: string[];
  defaultZoneId?: string;
  threadId?: string;
  className?: string;
  children?: ReactNode;
  showPresence?: boolean;
}

export function RealtimeChatShell({
  initializer,
  zoneIds,
  defaultZoneId,
  threadId,
  className,
  children,
  showPresence = true,
}: RealtimeChatShellProps) {
  const actions = useRealtimeChatActions();
  useRealtimeChatInitializer(initializer);
  const { connectionStatus, lastConnectionError } = useRealtimeConnection();
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const zoneKey = zoneIds?.join("|") ?? "";

  useEffect(() => {
    if (!zoneIds || zoneIds.length === 0) {
      if (defaultZoneId) {
        actions.joinZone(defaultZoneId);
        actions.setActiveZone(defaultZoneId);
      }
      return;
    }
    zoneIds.forEach((zoneId) => actions.joinZone(zoneId));
    if (defaultZoneId) {
      actions.setActiveZone(defaultZoneId);
    }
  }, [actions, defaultZoneId, zoneKey]);

  const handlePresenceSelect = (player: PlayerPresence) => {
    // Placeholder: future implementation will resolve or create DM thread before focusing.
    void player;
  };

  return (
    <div className={`flex h-96 w-full bg-neutral-950 text-neutral-100 ${className ?? ""}`}>
      <ThreadListPanel />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 text-xs uppercase tracking-wide text-neutral-400">
          <span>
            Connection:{" "}
            <strong
              className={
                connectionStatus === "connected"
                  ? "text-emerald-400"
                  : connectionStatus === "error"
                    ? "text-red-400"
                    : "text-neutral-300"
              }
            >
              {connectionStatus}
            </strong>
            {lastConnectionError && <span className="ml-2 text-red-400">{lastConnectionError}</span>}
          </span>
          <span className="flex items-center gap-4">
            <span>World unread: {unreadWorldTotal}</span>
            <span>DM unread: {unreadDirectTotal}</span>
          </span>
        </header>
        <div className="grid flex-1 grid-cols-1 divide-y divide-neutral-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <WorldChatPanel zoneId={defaultZoneId} />
          <DirectMessagesPanel threadId={threadId} />
        </div>
        {children}
      </div>
      {showPresence && <PresenceSidebar onSelectPlayer={handlePresenceSelect} />}
    </div>
  );
}
