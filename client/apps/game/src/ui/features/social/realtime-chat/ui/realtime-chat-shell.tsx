import { ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/ui/design-system/atoms";
import {
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimeTotals,
  useRealtimePresence,
} from "../hooks/use-realtime-chat";
import type { InitializeRealtimeClientParams, ChatTab } from "../model/types";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { WorldChatPanel } from "./world-chat/world-chat-panel";
import { TabBar } from "./shared/tab-bar";
import { UserDropdown } from "./shared/user-dropdown";

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
  const openTabs = useRealtimeChatSelector((state) => state.openTabs);
  const activeTabId = useRealtimeChatSelector((state) => state.activeTabId);
  useRealtimeChatInitializer(initializer);
  const { connectionStatus, lastConnectionError } = useRealtimeConnection();
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const presence = useRealtimePresence();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isHeightExpanded, setIsHeightExpanded] = useState(true);
  const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("realtime-chat-pinned-users");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const zoneKey = zoneIds?.join("|") ?? "";

  useEffect(() => {
    if (!zoneIds || zoneIds.length === 0) {
      if (defaultZoneId) {
        actions.joinZone(defaultZoneId);
        actions.setActiveZone(defaultZoneId);
        // Create default world tab if no tabs exist
        if (openTabs.length === 0) {
          actions.addTab({
            id: `world-${defaultZoneId}`,
            type: "world",
            label: `World`,
            targetId: defaultZoneId,
            unreadCount: 0,
          });
        }
      }
      return;
    }
    zoneIds.forEach((zoneId) => actions.joinZone(zoneId));
    if (defaultZoneId) {
      actions.setActiveZone(defaultZoneId);
      // Create default world tab if no tabs exist
      if (openTabs.length === 0) {
        actions.addTab({
          id: `world-${defaultZoneId}`,
          type: "world",
          label: `World`,
          targetId: defaultZoneId,
          unreadCount: 0,
        });
      }
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

  const toggleHeightExpand = () => {
    setIsHeightExpanded(!isHeightExpanded);
  };

  const handleUserSelect = (userId: string) => {
    const threadId = actions.openDirectThread(userId);
    if (threadId) {
      const user = presence.find((p) => p.playerId === userId);
      const displayName = user?.displayName ?? userId;
      actions.addTab({
        id: `dm-${threadId}`,
        type: "dm",
        label: displayName.slice(0, 12),
        targetId: threadId,
        unreadCount: 0,
      });
    }
    setShowUserDropdown(false);
  };

  const handleTogglePin = (userId: string) => {
    setPinnedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      localStorage.setItem("realtime-chat-pinned-users", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleSaveChat = () => {
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;

    let content = `Chat Export - ${activeTab.label}\n`;
    content += `Exported at: ${new Date().toLocaleString()}\n\n`;

    // Export logic here - similar to old chat
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${activeTab.label}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const unreadBadgeClass = "rounded-full border px-2 py-0.5 text-[11px] leading-none";

  return (
    <div className={`w-full ${className ?? ""}`}>
      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 bg-black/30 hover:bg-black/60 ${
          isExpanded ? (isHeightExpanded ? "h-[600px]" : "h-72") : "h-14"
        } w-[800px] max-w-[45vw]`}
      >
        {/* Header - Only shown when not expanded */}
        {!isExpanded && (
          <header className="flex items-center justify-between bg-transparent text-xs uppercase tracking-wide border-b border-gold/30 px-2 py-1">
            <Button
              type="button"
              variant="outline"
              onClick={toggleExpanded}
              className="flex items-center gap-2 px-2 py-1 transition text-gold/70 hover:text-gold border-gold/30"
            >
              <span className="text-[11px] font-semibold">Open Chat</span>
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
              <span className="flex items-center gap-1 normal-case text-gold/70">
                World
                <span
                  className={`${unreadBadgeClass} ${
                    unreadWorldTotal > 0 ? "bg-red/30 text-white animate-pulse" : "border-gold/30 text-gold/50"
                  }`}
                >
                  {unreadWorldTotal}
                </span>
              </span>
              <span className="flex items-center gap-1 normal-case text-gold/70">
                DM
                <span
                  className={`${unreadBadgeClass} ${
                    unreadDirectTotal > 0 ? "bg-red/30 text-white animate-pulse" : "border-gold/30 text-gold/50"
                  }`}
                >
                  {unreadDirectTotal}
                </span>
              </span>
            </div>
          </header>
        )}

        {isExpanded && (
          <>
            {/* Tab Bar */}
            <div className="relative">
              <TabBar
                tabs={openTabs}
                activeTabId={activeTabId}
                onTabClick={(tabId) => actions.setActiveTab(tabId)}
                onTabClose={(tabId) => actions.removeTab(tabId)}
                onAddDM={() => setShowUserDropdown(!showUserDropdown)}
                onSave={handleSaveChat}
                onMinimize={() => actions.setShellOpen(false)}
                onToggleExpand={toggleHeightExpand}
                isExpanded={isHeightExpanded}
              />
              {showUserDropdown && (
                <UserDropdown
                  users={presence}
                  onUserSelect={handleUserSelect}
                  onClose={() => setShowUserDropdown(false)}
                  pinnedUsers={pinnedUsers}
                  onTogglePin={handleTogglePin}
                  className="mt-1"
                />
              )}
            </div>

            {/* Single Active Panel */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab?.type === "world" || activeTab?.type === "zone" ? (
                <WorldChatPanel zoneId={activeTab.targetId} zoneLabel={activeTab.label} />
              ) : activeTab?.type === "dm" ? (
                <DirectMessagesPanel threadId={activeTab.targetId} />
              ) : (
                <div className="flex items-center justify-center h-full text-gold/50 text-sm">
                  No chat selected. Click "+ DM" to start a conversation.
                </div>
              )}
            </div>
            {children}
          </>
        )}
      </div>
    </div>
  );
}
