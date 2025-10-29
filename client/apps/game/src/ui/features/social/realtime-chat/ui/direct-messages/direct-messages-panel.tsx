import { useEffect, useMemo, useRef } from "react";

import {
  useDirectMessageControls,
  useDirectThread,
  useRealtimeChatSelector,
  useRealtimeTypingIndicators,
} from "../../hooks/use-realtime-chat";
import type { DirectMessage } from "../../model/types";
import { MessageComposer } from "../shared/message-composer";

interface DirectMessagesPanelProps {
  threadId?: string;
  className?: string;
}

const toDisplayTime = (message: DirectMessage) => {
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

const truncateIdentifier = (value: string, visibleChars = 4) => {
  if (!value) return value;
  const normalized = value.trim();
  if (normalized.length <= visibleChars * 2 + 3) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
};

export function DirectMessagesPanel({ threadId, className }: DirectMessagesPanelProps) {
  // Select values individually to prevent infinite re-renders
  const fallbackThreadId = useRealtimeChatSelector((state) => state.activeThreadId ?? Object.keys(state.dmThreads)[0]);
  const resolvedThreadId = threadId ?? fallbackThreadId;
  const { thread } = useDirectThread(resolvedThreadId);
  const identity = useRealtimeChatSelector((state) => state.identity);
  const identityId = identity?.playerId ?? "";
  const identityWallet = identity?.walletAddress ?? null;
  const typingIndicators = useRealtimeTypingIndicators();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const selfAliases = useMemo(() => {
    const aliases: string[] = [];
    if (identityId) {
      aliases.push(identityId);
    }
    if (identityWallet && !aliases.includes(identityWallet)) {
      aliases.push(identityWallet);
    }
    return aliases;
  }, [identityId, identityWallet]);

  const recipientId = useMemo(() => {
    if (!thread?.thread) return undefined;
    return (
      thread.thread.participants.find((participant: string) => !selfAliases.includes(participant)) ??
      thread.thread.participants[0]
    );
  }, [selfAliases, thread]);

  const recipientLabel = useMemo(() => {
    if (!recipientId) return undefined;
    return truncateIdentifier(recipientId, 6);
  }, [recipientId]);

  const onlinePlayers = useRealtimeChatSelector((state) => state.onlinePlayers);
  const isRecipientOnline = useMemo(() => {
    if (!recipientId) return false;
    return onlinePlayers[recipientId]?.isOnline ?? false;
  }, [recipientId, onlinePlayers]);

  const { sendMessage, loadHistory, markAsRead } = useDirectMessageControls(resolvedThreadId, recipientId);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (resolvedThreadId) {
      markAsRead();
    }
  }, [markAsRead, resolvedThreadId]);

  // Initial load of messages
  useEffect(() => {
    if (
      resolvedThreadId &&
      thread &&
      thread.messages.length === 0 &&
      thread.hasMoreHistory &&
      !thread.isFetchingHistory
    ) {
      loadHistory(undefined);
    }
  }, [resolvedThreadId, thread, loadHistory]);

  // Intersection Observer for auto-loading older messages on scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !thread?.hasMoreHistory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !thread.isFetchingHistory && thread.hasMoreHistory && !isLoadingRef.current) {
          isLoadingRef.current = true;
          const currentScrollHeight = scrollContainerRef.current?.scrollHeight ?? 0;

          loadHistory(thread.lastFetchedCursor ?? undefined).then(() => {
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
      { threshold: 0.1, rootMargin: "100px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [thread?.hasMoreHistory, thread?.isFetchingHistory, thread?.lastFetchedCursor, loadHistory]);

  const typing = useMemo(() => {
    if (!resolvedThreadId) return [];
    return Object.values(typingIndicators).filter(
      (indicator) => indicator.threadId === resolvedThreadId && indicator.isTyping,
    );
  }, [resolvedThreadId, typingIndicators]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (isAtBottom || thread?.unreadCount === 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [thread?.messages.length, thread?.unreadCount]);

  // Scroll to bottom when panel becomes visible or resizes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !resolvedThreadId) return;

    // Delay to ensure content is rendered
    const timer = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 100);

    return () => clearTimeout(timer);
  }, [resolvedThreadId]);

  // Scroll to bottom when container height changes (expand/collapse)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      // Scroll to bottom when height increases
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <div className="flex-1 min-h-0 px-4 py-3">
        {!thread && <p className="text-sm text-gold/50">Select a conversation to get started.</p>}
        {thread && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1 scroll-smooth">
              {/* Sentinel for auto-loading older messages */}
              <div ref={topSentinelRef} className="h-1" />

              {thread.isFetchingHistory && (
                <div className="flex justify-center py-2">
                  <span className="text-xs text-gold/50">Loading older messages...</span>
                </div>
              )}

              <ul className="flex flex-col gap-0.5">
                {thread.messages.map((message) => {
                  const isOwn = selfAliases.includes(message.senderId);
                  const displayLabel = isOwn ? "You" : truncateIdentifier(message.senderId);
                  return (
                    <li key={message.id} className="text-[13px] leading-tight text-white/90">
                      <span className="text-white/20">[{toDisplayTime(message)}]</span>{" "}
                      <span className="text-gold/90">&lt;{displayLabel}&gt;</span>{" "}
                      <span className="break-words">{message.content}</span>
                    </li>
                  );
                })}
                {thread.messages.length === 0 && (
                  <li className="text-sm text-gold/50">No messages yet. Say hi to start the conversation!</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div>
        <MessageComposer
          onSend={async (value) => {
            if (!recipientId) return;
            await sendMessage(value);
          }}
          placeholder={recipientLabel ? `Message ${recipientLabel}` : "Select a conversation to send a message"}
          disabled={!recipientId}
          isRecipientOffline={!isRecipientOnline && !!recipientId}
          recipientName={recipientLabel}
        />
      </div>
    </section>
  );
}
