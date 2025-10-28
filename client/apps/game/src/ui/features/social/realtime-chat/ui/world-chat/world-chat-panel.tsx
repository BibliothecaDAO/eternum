import { useEffect, useMemo, useRef } from "react";

import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeWorldZone,
  useWorldChatControls,
} from "../../hooks/use-realtime-chat";
import type { WorldChatMessage } from "../../model/types";
import { MessageComposer } from "../shared/message-composer";
import { UserAvatar } from "../shared/user-avatar";

interface WorldChatPanelProps {
  zoneId?: string;
  zoneLabel?: string;
  className?: string;
}

type MessagePart = {
  type: "text" | "coordinates";
  content: string | { x: number; y: number };
};

// Helper function to detect coordinates in message and split message into parts
const processMessage = (message: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let lastIndex = 0;

  // Find all coordinate matches (with optional space after comma)
  const regex = /(-?\d+),\s*(-?\d+)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    // Add text before coordinates
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: message.slice(lastIndex, match.index),
      });
    }

    // Add coordinates
    parts.push({
      type: "coordinates",
      content: {
        x: parseInt(match[1]),
        y: parseInt(match[2]),
      },
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < message.length) {
    parts.push({
      type: "text",
      content: message.slice(lastIndex),
    });
  }

  return parts;
};

// Coordinate navigation button component
const CoordinateNavButton = ({ coordinates }: { coordinates: { x: number; y: number } }) => {
  return (
    <button
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-gold hover:text-gold/50 transition-colors duration-200 rounded bg-gold/15 hover:bg-gold/25"
      onClick={() => console.log("Navigate to:", coordinates)}
    >
      <span className="text-xs">{`${coordinates.x}, ${coordinates.y}`}</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path d="M8.25 10.875a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0z" />
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.125 4.5a4.125 4.125 0 102.338 7.524l2.007 2.006a.75.75 0 101.06-1.06l-2.006-2.007a4.125 4.125 0 00-3.399-6.463z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
};

interface MessageGroup {
  senderId: string;
  senderName: string;
  isOnline: boolean;
  messages: WorldChatMessage[];
}

// Group consecutive messages by sender
const groupMessages = (messages: WorldChatMessage[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  messages.forEach((message) => {
    const senderId = message.sender.playerId;
    const senderName = message.sender.displayName?.trim() || message.sender.playerId || "Unknown";

    if (!currentGroup || currentGroup.senderId !== senderId) {
      currentGroup = {
        senderId,
        senderName,
        isOnline: true, // We'll need presence info for this
        messages: [message],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(message);
    }
  });

  return groups;
};

const formatWorldMessageTime = (message: WorldChatMessage) => {
  const created = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  if (created instanceof Date && !Number.isNaN(created.getTime())) {
    return created.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return "Now";
};

const formatSenderName = (message: WorldChatMessage) =>
  message.sender.displayName?.trim() || message.sender.playerId || "Unknown adventurer";

const truncateWallet = (wallet?: string, visibleChars = 4) => {
  if (!wallet) return undefined;
  const normalized = wallet.trim();
  if (normalized.length <= visibleChars * 2 + 3) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
};

export function WorldChatPanel({ zoneId, zoneLabel, className }: WorldChatPanelProps) {
  // Select value directly to prevent infinite re-renders
  const fallbackZoneId = useRealtimeChatSelector((state) => state.activeZoneId ?? Object.keys(state.worldZones)[0]);
  const resolvedZoneId = zoneId ?? fallbackZoneId;
  const actions = useRealtimeChatActions();
  const { zone, isActive } = useRealtimeWorldZone(resolvedZoneId);
  const { sendMessage, loadHistory, markAsRead, setActive } = useWorldChatControls(resolvedZoneId);
  const messages = zone?.messages ?? [];
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (resolvedZoneId) {
      actions.joinZone(resolvedZoneId);
      actions.setActiveZone(resolvedZoneId);
    }
  }, [actions, resolvedZoneId]);

  useEffect(() => {
    if (isActive && resolvedZoneId) {
      markAsRead();
    }
  }, [isActive, markAsRead, resolvedZoneId]);

  // Initial load of messages
  useEffect(() => {
    if (resolvedZoneId && zone && messages.length === 0 && zone.hasMoreHistory && !zone.isFetchingHistory) {
      loadHistory(undefined);
    }
  }, [resolvedZoneId, zone, messages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (isActive || isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isActive]);

  // Intersection Observer for auto-loading older messages on scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !zone?.hasMoreHistory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !zone.isFetchingHistory && zone.hasMoreHistory && !isLoadingRef.current) {
          isLoadingRef.current = true;
          const currentScrollHeight = scrollContainerRef.current?.scrollHeight ?? 0;

          loadHistory(zone.lastFetchedCursor ?? undefined).then(() => {
            // Maintain scroll position after loading
            requestAnimationFrame(() => {
              if (scrollContainerRef.current) {
                const newScrollHeight = scrollContainerRef.current.scrollHeight;
                const scrollDiff = newScrollHeight - currentScrollHeight;
                scrollContainerRef.current.scrollTop += scrollDiff;
              }
              isLoadingRef.current = false;
            });
          });
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [zone?.hasMoreHistory, zone?.isFetchingHistory, zone?.lastFetchedCursor, loadHistory]);

  const displayLabel = useMemo(() => {
    if (zoneLabel) return zoneLabel;
    if (resolvedZoneId) return `Zone ${resolvedZoneId}`;
    return "World Chat";
  }, [resolvedZoneId, zoneLabel]);

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <div className="flex-1 min-h-0 px-4 py-3">
        {!zone && <p className="text-sm text-gold/50">Join a zone to view chat.</p>}
        {zone && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1 scroll-smooth">
              {/* Sentinel for auto-loading older messages */}
              <div ref={topSentinelRef} className="h-1" />

              {zone.isFetchingHistory && (
                <div className="flex justify-center py-2">
                  <span className="text-xs text-gold/50">Loading older messages...</span>
                </div>
              )}

              {messageGroups.length === 0 && !zone.isFetchingHistory && (
                <p className="text-sm text-gold/50">No messages yet. Be the first to say hello!</p>
              )}
              {messageGroups.map((group, groupIndex) => (
                <div key={`${group.senderId}-${groupIndex}`} className="message-group space-y-0.5 mt-2">
                  {group.messages.map((message, messageIndex) => {
                    const messageParts = processMessage(message.content);
                    const isFirstInGroup = messageIndex === 0;
                    return (
                      <div
                        key={message.id}
                        className="text-sm group hover:bg-gold/5 transition-colors duration-200 py-0.5"
                      >
                        <div className="flex items-start gap-1">
                          {isFirstInGroup && (
                            <div className="flex items-center gap-1 mr-1">
                              <UserAvatar name={group.senderName} isOnline={group.isOnline} size="sm" />
                            </div>
                          )}
                          {!isFirstInGroup && <div className="w-6 flex-shrink-0" />}
                          <span className="text-white/20 text-xs inline-block w-[34px] text-right shrink-0">
                            {formatWorldMessageTime(message)}
                          </span>
                          <div className="flex-1 min-w-0">
                            {isFirstInGroup && (
                              <div className="flex items-center gap-1">
                                <span className="font-bold px-1.5 py-0.5 rounded text-orange-300 hover:text-orange-200 hover:bg-orange-300/10 cursor-pointer transition-colors duration-200">
                                  {group.senderName}
                                </span>
                                {message.sender.walletAddress && (
                                  <span
                                    className="max-w-[100px] truncate rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                                    title={message.sender.walletAddress}
                                  >
                                    {truncateWallet(message.sender.walletAddress)}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="break-words text-white/90 ml-1">
                              {messageParts.map((part, i) => (
                                <span key={i}>
                                  {part.type === "text" ? (
                                    <>{part.content}</>
                                  ) : (
                                    <CoordinateNavButton coordinates={part.content as { x: number; y: number }} />
                                  )}
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="">
        <MessageComposer
          onSend={async (value) => {
            if (!resolvedZoneId) return;
            await sendMessage({ content: value, zoneId: resolvedZoneId });
          }}
          placeholder={resolvedZoneId ? `Message zone ${resolvedZoneId}` : "Select a zone to chat"}
          disabled={!resolvedZoneId}
        />
      </div>
    </section>
  );
}
