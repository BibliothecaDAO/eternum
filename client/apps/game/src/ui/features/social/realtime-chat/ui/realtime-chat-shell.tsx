import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ReactNode, useEffect, useState } from "react";

import {
  useRealtimeChatActions,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimePresence,
} from "../hooks/use-realtime-chat";
import { useRealtimeChatStore } from "../model/store";
import type { InitializeRealtimeClientParams } from "../model/types";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { TabBar } from "./shared/tab-bar";
import { UserDropdown } from "./shared/user-dropdown";
import { WorldChatPanel } from "./world-chat/world-chat-panel";
import { RealtimeChatToggleButton } from "./shared/realtime-chat-toggle-button";

export interface RealtimeChatShellProps {
  initializer?: InitializeRealtimeClientParams | null;
  zoneIds?: string[];
  defaultZoneId?: string;
  threadId?: string;
  className?: string;
  children?: ReactNode;
  displayMode?: "floating" | "embedded";
  showInlineToggle?: boolean;
  autoInitializeClient?: boolean;
}

export function RealtimeChatShell({
  initializer,
  zoneIds,
  defaultZoneId,
  threadId,
  className,
  children,
  displayMode = "floating",
  showInlineToggle = true,
  autoInitializeClient = true,
}: RealtimeChatShellProps) {
  const isEmbedded = displayMode === "embedded";
  const actions = useRealtimeChatActions();
  const isExpanded = useRealtimeChatSelector((state) => state.isShellOpen);
  const openTabs = useRealtimeChatSelector((state) => state.openTabs);
  const activeTabId = useRealtimeChatSelector((state) => state.activeTabId);
  useRealtimeChatInitializer(autoInitializeClient ? initializer : null);
  const { connectionStatus, lastConnectionError } = useRealtimeConnection();
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

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex flex-col overflow-hidden transition-all duration-300 rounded-2xl bg-black/70",
          isExpanded
            ? isHeightExpanded
              ? isEmbedded
                ? "h-full"
                : "h-[600px]"
              : isEmbedded
                ? "h-64"
                : "h-72"
            : showInlineToggle
              ? isEmbedded
                ? "h-16"
                : "h-14"
              : "h-0 min-h-0 pointer-events-none",
          isEmbedded ? "w-full" : "w-[800px] max-w-[45vw]",
          !isExpanded && !showInlineToggle && "w-0 max-w-0",
          isExpanded ? "bg-black/80" : "bg-transparent",
        )}
      >
        {/* Header - Only shown when not expanded */}
        {!isExpanded && showInlineToggle && (
          <div className="flex items-center justify-end w-full h-full px-2">
            <RealtimeChatToggleButton />
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
