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
    return created.toLocaleTimeString();
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

  const { sendMessage, loadHistory, markAsRead } = useDirectMessageControls(resolvedThreadId, recipientId);

  useEffect(() => {
    if (resolvedThreadId) {
      markAsRead();
    }
  }, [markAsRead, resolvedThreadId]);

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

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col  ${className ?? ""}`}>
      <header className="border-b border-gold/30 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold ">{recipientLabel ?? "Direct Messages"}</h2>
        </div>
      </header>
      <div className="flex-1 min-h-0 px-4 py-3">
        {!thread && <p className="text-sm ">Select a conversation to get started.</p>}
        {thread && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {thread.hasMoreHistory && (
              <button
                type="button"
                onClick={() => loadHistory(thread.lastFetchedCursor ?? undefined)}
                className="mb-3 w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
              >
                Load older messages
              </button>
            )}
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
              <ul className="flex flex-col gap-1.5">
                {thread.messages.map((message) => {
                  const isOwn = selfAliases.includes(message.senderId);
                  const displayLabel = isOwn ? "You" : truncateIdentifier(message.senderId);
                  return (
                    <li key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <article
                        className={`max-w-[80%] rounded-md bg-neutral-800/70 px-3 py-1.5 text-sm text-neutral-100 shadow-sm ring-1 ring-transparent transition ${
                          isOwn ? "ring-amber-400/60" : "hover:bg-neutral-800 hover:ring-amber-400/40"
                        }`}
                      >
                        <header className="flex items-center justify-between gap-2 text-[11px] ">
                          <span className="truncate font-medium text-neutral-100" title={displayLabel}>
                            {displayLabel}
                          </span>
                          <span className="whitespace-nowrap text-[10px] uppercase tracking-wide ">
                            {toDisplayTime(message)}
                          </span>
                        </header>
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-tight text-neutral-100">
                          {message.content}
                        </p>
                      </article>
                    </li>
                  );
                })}
                {thread.messages.length === 0 && (
                  <li className="text-sm ">No messages yet. Say hi to start the conversation!</li>
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
        />
      </div>
    </section>
  );
}
