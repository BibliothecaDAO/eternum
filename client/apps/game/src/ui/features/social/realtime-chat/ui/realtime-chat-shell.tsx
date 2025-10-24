import { ReactNode, useEffect, useMemo } from "react";

import { Button } from "@/ui/design-system/atoms";
import {
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimeTotals,
} from "../hooks/use-realtime-chat";
import type { InitializeRealtimeClientParams } from "../model/types";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { ThreadListPanel } from "./direct-messages/thread-list-panel";
import { WorldChatPanel } from "./world-chat/world-chat-panel";

export interface RealtimeChatShellProps {
  initializer?: InitializeRealtimeClientParams | null;
  zoneIds?: string[];
  defaultZoneId?: string;
  threadId?: string;
  className?: string;
  children?: ReactNode;
}

export function RealtimeChatShell({
  initializer,
  zoneIds,
  defaultZoneId,
  threadId,
  className,
  children,
}: RealtimeChatShellProps) {
  const actions = useRealtimeChatActions();
  const isExpanded = useRealtimeChatSelector((state) => state.isShellOpen);
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

  const connectionIndicator = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      default:
        return "text-neutral-300";
    }
  }, [connectionStatus]);

  const toggleExpanded = () => {
    actions.setShellOpen(!isExpanded);
  };

  const unreadBadgeClass = "rounded-full border px-2 py-0.5 text-[11px] leading-none";

  return (
    <div className={`w-full ${className ?? ""}`}>
      <div
        className={`flex flex-col overflow-hidden transition-[height,_transform] duration-200 panel-wood bg-dark-wood  ${
          isExpanded ? "h-[60vh] max-h-[600px]" : "h-14"
        }`}
      >
        <header className="flex items-center justify-between  bg-dark-wood text-xs uppercase tracking-wide border-b border-gold/30">
          <Button
            type="button"
            variant="outline"
            onClick={toggleExpanded}
            className="flex items-center gap-2 px-2 py-1 transition hover:bg-neutral-800"
          >
            <span className="text-[11px] font-semibold">{isExpanded ? "Hide Chat" : "Open Chat"}</span>
            <span
              className={`h-2 w-2 rounded-full animate-pulse ${
                connectionStatus === "connected"
                  ? "bg-emerald-400"
                  : connectionStatus === "error"
                    ? "bg-red-400"
                    : "bg-neutral-500"
              }`}
            />
          </Button>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={`font-semibold ${connectionIndicator}`}>{connectionStatus}</span>
            {lastConnectionError && <span className="text-red-400 normal-case">{lastConnectionError}</span>}
            <span className="flex items-center gap-1 normal-case">
              World
              <span
                className={`${unreadBadgeClass} ${
                  unreadWorldTotal > 0 ? "border-amber-400 text-amber-300" : "border-neutral-700 "
                }`}
              >
                {unreadWorldTotal}
              </span>
            </span>
            <span className="flex items-center gap-1 normal-case">
              DM
              <span
                className={`${unreadBadgeClass} ${
                  unreadDirectTotal > 0 ? "border-amber-400 text-amber-300" : "border-neutral-700 "
                }`}
              >
                {unreadDirectTotal}
              </span>
            </span>
          </div>
        </header>
        {isExpanded ? (
          <div className="flex flex-1 min-h-0">
            <ThreadListPanel className="hidden xl:flex" />
            <div className="flex flex-1 min-h-0 flex-col">
              <div className="grid flex-1 min-h-0 grid-cols-1 divide-y divide-neutral-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                <WorldChatPanel zoneId={defaultZoneId} />
                <DirectMessagesPanel threadId={threadId} />
              </div>
              {children}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between px-4 text-[11px] ">
            <span className="normal-case">Tap to open chat and catch up on conversations.</span>
            <div className="flex items-center gap-3 normal-case">
              <span>World unread: {unreadWorldTotal}</span>
              <span>DM unread: {unreadDirectTotal}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
