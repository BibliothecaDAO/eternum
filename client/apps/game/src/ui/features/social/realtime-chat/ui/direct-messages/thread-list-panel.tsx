import { useMemo } from "react";

import { useRealtimeChatActions, useRealtimeChatSelector } from "../../hooks/use-realtime-chat";
import type { DirectMessageThreadState } from "../../model/types";

const getThreadOrderKey = (thread: DirectMessageThreadState) => {
  const updatedAt = thread.thread.updatedAt ?? thread.thread.createdAt;
  const date = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  return date instanceof Date ? date.getTime() : Date.now();
};

export interface ThreadListPanelProps {
  onSelectThread?(threadId: string): void;
  className?: string;
}

export function ThreadListPanel({ onSelectThread, className }: ThreadListPanelProps) {
  const actions = useRealtimeChatActions();

  // Select values individually to prevent infinite re-renders
  const threads = useRealtimeChatSelector((state) => state.dmThreads);
  const activeThreadId = useRealtimeChatSelector((state) => state.activeThreadId);
  const identity = useRealtimeChatSelector((state) => state.identity);
  const identityId = identity?.playerId ?? null;
  const identityWallet = identity?.walletAddress ?? null;

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

  const sortedThreads = useMemo(() => {
    return Object.values(threads)
      .sort((a, b) => getThreadOrderKey(b) - getThreadOrderKey(a))
      .slice(0, 100);
  }, [threads]);

  const handleSelect = (threadId: string) => {
    actions.setActiveThread(threadId);
    onSelectThread?.(threadId);
  };

  return (
    <aside className={`flex h-full w-32 flex-col bg-neutral-950 ${className ?? ""}`}>
      <header className="border-b border-neutral-800 p-3">
        <h2 className="text-sm font-semibold text-neutral-200">Direct Messages</h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        {sortedThreads.length === 0 && <p className="px-3 py-4 text-sm text-neutral-500">No direct messages yet.</p>}
        <ul className="space-y-1 p-2">
          {sortedThreads.map((thread) => {
            const otherParticipant =
              thread.thread.participants.find((participant: string) => !selfAliases.includes(participant)) ??
              thread.thread.participants[0];
            const isActive = thread.thread.id === activeThreadId;
            const unread = thread.unreadCount;

            return (
              <li key={thread.thread.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(thread.thread.id)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                    isActive ? "bg-neutral-800 text-neutral-100" : "text-neutral-300 hover:bg-neutral-900"
                  }`}
                >
                  <span className="truncate">{otherParticipant}</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-neutral-900">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
