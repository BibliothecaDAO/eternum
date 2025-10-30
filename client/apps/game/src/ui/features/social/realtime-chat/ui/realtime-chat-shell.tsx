import { ReactNode, useEffect, useMemo, useState } from "react";

import {
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimePresence,
  useRealtimeTotals,
} from "../hooks/use-realtime-chat";
import { useRealtimeChatStore } from "../model/store";
import type { InitializeRealtimeClientParams } from "../model/types";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { TabBar } from "./shared/tab-bar";
import { UserDropdown } from "./shared/user-dropdown";
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
            closeable: false, // World tab cannot be closed
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
          closeable: false, // World tab cannot be closed
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

    // Get messages based on tab type
    const state = useRealtimeChatStore.getState();
    if (activeTab.type === "world" || activeTab.type === "zone") {
      const zone = state.worldZones[activeTab.targetId];
      if (zone) {
        zone.messages.forEach((msg) => {
          const time = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
          const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
          const senderName = msg.sender.displayName?.trim() || msg.sender.playerId || "Unknown";
          content += `[${timeStr}] <${senderName}> ${msg.content}\n`;
        });
      }
    } else if (activeTab.type === "dm") {
      const thread = state.dmThreads[activeTab.targetId];
      if (thread) {
        thread.messages.forEach((msg) => {
          const time = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
          const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
          content += `[${timeStr}] <${msg.senderId}> ${msg.content}\n`;
        });
      }
    }

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
        className={`flex flex-col overflow-hidden transition-all duration-300 ${
          isExpanded ? (isHeightExpanded ? "h-[600px]" : "h-72") : "h-14"
        } w-[800px] max-w-[45vw] ${isExpanded ? "bg-black/30 hover:bg-black/60" : "bg-transparent"}`}
      >
        {/* Header - Only shown when not expanded */}
        {!isExpanded && (
          <div className="flex items-center justify-end w-full h-full px-2">
            <button
              type="button"
              onClick={toggleExpanded}
              className="flex items-center gap-2 px-3 py-1.5 mr-20 mb-3 transition text-gold/70 hover:text-gold border border-gold/30 hover:border-gold panel-wood bg-dark/70 hover:bg-dark/60 rounded text-xs shadow-inner shadow-black/30"
            >
              <span className="font-medium">Open Chat</span>
              {(unreadWorldTotal > 0 || unreadDirectTotal > 0) && (
                <span className="bg-red/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {unreadWorldTotal + unreadDirectTotal}
                </span>
              )}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : connectionStatus === "error"
                      ? "bg-red-400"
                      : "bg-neutral-500"
                }`}
              />
            </button>
          </div>
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
