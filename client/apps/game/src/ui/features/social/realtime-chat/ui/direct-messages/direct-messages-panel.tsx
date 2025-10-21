import { useEffect, useMemo } from "react";

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

export function DirectMessagesPanel({ threadId, className }: DirectMessagesPanelProps) {
  // Select values individually to prevent infinite re-renders
  const fallbackThreadId = useRealtimeChatSelector((state) => state.activeThreadId ?? Object.keys(state.dmThreads)[0]);
  const resolvedThreadId = threadId ?? fallbackThreadId;
  const { thread } = useDirectThread(resolvedThreadId);
  const identityId = useRealtimeChatSelector((state) => state.identity?.playerId ?? "");
  const typingIndicators = useRealtimeTypingIndicators();

  const recipientId = useMemo(() => {
    if (!thread?.thread) return undefined;
    return (
      thread.thread.participants.find((participant: string) => participant !== identityId) ?? thread.thread.participants[0]
    );
  }, [identityId, thread]);

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

  return (
    <section className={`flex h-full flex-1 flex-col bg-neutral-900 ${className ?? ""}`}>
      <header className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-200">{recipientId ?? "Direct Messages"}</h2>
        <p className="text-xs text-neutral-500">{typing.length > 0 ? "Typing…" : "Private conversation"}</p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!thread && <p className="text-sm text-neutral-500">Select a conversation to get started.</p>}
        {thread && (
          <>
            {thread.hasMoreHistory && (
              <button
                type="button"
                onClick={() => loadHistory(thread.lastFetchedCursor ?? undefined)}
                className="mb-3 w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                Load older messages
              </button>
            )}
            <ul className="space-y-2">
              {thread.messages.map((message) => {
                const isOwn = message.senderId === identityId;
                return (
                  <li key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs rounded px-3 py-2 text-sm ${
                        isOwn ? "bg-amber-500 text-neutral-900" : "bg-neutral-800 text-neutral-100"
                      }`}
                    >
                      <p className="break-words">{message.content}</p>
                      <span className="mt-1 block text-right text-[10px] uppercase tracking-wide text-neutral-300">
                        {toDisplayTime(message)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <div className="border-t border-neutral-800 p-4">
        <MessageComposer
          onSend={async (value) => {
            if (!recipientId) return;
            await sendMessage(value);
          }}
          placeholder={recipientId ? `Message ${recipientId}` : "Select a conversation to send a message"}
          disabled={!recipientId}
        />
      </div>
    </section>
  );
}
