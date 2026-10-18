import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ReactNode, useEffect, useState } from "react";
import { GLOBAL_CHAT_CHANNEL_ID, formatClockTime, formatMoment } from "@bibliothecadao/types";

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

interface RealtimeChatShellProps {
  initializer?: InitializeRealtimeClientParams | null;
  defaultZoneId?: string;
  gameZoneId?: string;
  threadId?: string;
  className?: string;
  children?: ReactNode;
  displayMode?: "floating" | "embedded";
  showInlineToggle?: boolean;
  autoInitializeClient?: boolean;
}

export function RealtimeChatShell({
  initializer,
  defaultZoneId,
  gameZoneId,
  threadId,
  className,
  children,
  displayMode = "floating",
  showInlineToggle = true,
  autoInitializeClient = true,
}: RealtimeChatShellProps) {
  const isEmbedded = displayMode === "embedded";
  const actions = useRealtimeChatActions();
  const shellOpen = useRealtimeChatSelector((state) => state.isShellOpen);
  const isExpanded = isEmbedded || shellOpen;
  const openTabs = useRealtimeChatSelector((state) => state.openTabs);
  const activeTabId = useRealtimeChatSelector((state) => state.activeTabId);
  const activeZoneId = useRealtimeChatSelector((state) => state.activeZoneId);
  const hasGameChat = useRealtimeChatSelector((state) =>
    Boolean(gameZoneId && state.joinedZoneIds.includes(gameZoneId)),
  );
  useRealtimeChatInitializer(autoInitializeClient ? initializer : null);
  const { connectionStatus, lastConnectionError } = useRealtimeConnection();
  const presence = useRealtimePresence();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isHeightExpanded, setIsHeightExpanded] = useState(true);
  const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("realtime-chat-pinned-users");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  useEffect(() => {
    if (defaultZoneId) actions.setWorldChatChannel(defaultZoneId);
  }, [actions, defaultZoneId, gameZoneId]);

  const selectWorldChannel = (zoneId: string) => {
    actions.setWorldChatChannel(zoneId);
    actions.setActiveTab(`world-${zoneId}`);
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
    content += `Exported at: ${formatMoment(Date.now() / 1000)}\n\n`;

    // Get messages based on tab type
    const state = useRealtimeChatStore.getState();
    if (activeTab.type === "world" || activeTab.type === "zone") {
      const zone = state.worldZones[activeTab.targetId];
      if (zone) {
        zone.messages.forEach((msg) => {
          const time = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
          const timeStr = formatClockTime(time.getTime() / 1000);
          const senderName = msg.sender.displayName?.trim() || msg.sender.playerId || "Unknown";
          content += `[${timeStr}] <${senderName}> ${msg.content}\n`;
        });
      }
    } else if (activeTab.type === "dm") {
      const thread = state.dmThreads[activeTab.targetId];
      if (thread) {
        thread.messages.forEach((msg) => {
          const time = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
          const timeStr = formatClockTime(time.getTime() / 1000);
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
          "flex flex-col overflow-hidden transition-all duration-300",
          // Embedded inside the bronze surface frame — stay transparent and
          // square so the shell's warm gradient + frame show through (the flat
          // black box read as a different surface from the rest of the HUD).
          isEmbedded ? "rounded-none bg-transparent" : "rounded-2xl bg-hud-well",
          isEmbedded
            ? "h-full min-h-0"
            : isExpanded
              ? isHeightExpanded
                ? isEmbedded
                  ? "h-full"
                  : "h-hud-chat-height"
                : isEmbedded
                  ? "h-64"
                  : "h-72"
              : showInlineToggle
                ? isEmbedded
                  ? "h-16"
                  : "h-14"
                : "h-0 min-h-0 pointer-events-none",
          isEmbedded ? "w-full" : "w-hud-chat-width max-lg:w-screen lg:max-w-hud-chat-cap",
          !isExpanded && !showInlineToggle && "w-0 max-w-0 max-lg:w-0",
          isExpanded && !isEmbedded ? "bg-hud-well" : "bg-transparent",
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
            {gameZoneId && (
              <div className="flex gap-1 border-b border-hud-divider px-3 py-2" role="group" aria-label="Chat channel">
                <button
                  type="button"
                  aria-pressed={activeZoneId === GLOBAL_CHAT_CHANNEL_ID}
                  className={cn(
                    "rounded px-3 py-1 text-hud-body max-lg:min-h-11",
                    activeZoneId === GLOBAL_CHAT_CHANNEL_ID
                      ? "bg-hud-chosen text-hud-accent"
                      : "text-hud-muted hover:text-hud-accent",
                  )}
                  onClick={() => selectWorldChannel(GLOBAL_CHAT_CHANNEL_ID)}
                >
                  Global
                </button>
                <button
                  type="button"
                  aria-pressed={activeZoneId === gameZoneId}
                  disabled={!hasGameChat}
                  title={
                    hasGameChat ? "Chat with players in this game" : "Game chat requires registration in this game"
                  }
                  className={cn(
                    "rounded px-3 py-1 text-hud-body disabled:cursor-not-allowed disabled:opacity-40 max-lg:min-h-11",
                    activeZoneId === gameZoneId
                      ? "bg-hud-chosen text-hud-accent"
                      : "text-hud-muted hover:text-hud-accent",
                  )}
                  onClick={() => selectWorldChannel(gameZoneId)}
                >
                  Game
                </button>
              </div>
            )}
            {/* Tab Bar */}
            <div className="relative">
              <TabBar
                showWindowControls={!isEmbedded}
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
                <div className="flex items-center justify-center h-full text-hud-cue text-hud-body">
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
