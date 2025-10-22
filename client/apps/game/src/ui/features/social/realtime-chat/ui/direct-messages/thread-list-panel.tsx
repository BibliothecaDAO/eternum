import { useMemo } from "react";

import { useRealtimeChatActions, useRealtimeChatSelector, useRealtimePresence } from "../../hooks/use-realtime-chat";
import type { DirectMessageThreadState } from "../../model/types";

const truncateIdentifier = (value: string, visibleChars = 4) => {
  if (!value) return value;
  const normalized = value.trim();
  if (normalized.length <= visibleChars * 2 + 3) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
};

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
  const presence = useRealtimePresence();

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

  const threadAliasesMap = useMemo(() => {
    const map = new Map<string, DirectMessageThreadState>();
    for (const thread of Object.values(threads)) {
      for (const participant of thread.thread.participants) {
        if (!selfAliases.includes(participant) && !map.has(participant)) {
          map.set(participant, thread);
        }
      }
    }
    return map;
  }, [threads, selfAliases]);

  const onlinePlayers = useMemo(() => {
    return presence
      .filter((player) => player.isOnline && !selfAliases.includes(player.playerId))
      .sort((a, b) => {
        const aName = a.displayName ?? a.playerId;
        const bName = b.displayName ?? b.playerId;
        return aName.localeCompare(bName);
      });
  }, [presence, selfAliases]);

  const handleSelect = (threadId: string) => {
    actions.setActiveThread(threadId);
    onSelectThread?.(threadId);
  };

  const handleSelectPlayer = (playerId: string) => {
    const threadId = actions.ensureDirectThread(playerId);
    if (threadId) {
      actions.setActiveThread(threadId);
      onSelectThread?.(threadId);
    }
  };

  return (
    <aside className={`flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-950 ${className ?? ""}`}>
      <header className="border-b border-neutral-800 px-3 py-3">
        <h2 className="text-sm font-semibold text-neutral-200">Direct Messages</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <section className="mb-4">
          <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Online</h3>
          <ul className="flex flex-col gap-1">
            {onlinePlayers.length === 0 && (
              <li className="px-1 text-xs text-neutral-600">No players online.</li>
            )}
            {onlinePlayers.map((player) => {
              const aliases = [player.playerId];
              if (player.walletAddress && !aliases.includes(player.walletAddress)) {
                aliases.push(player.walletAddress);
              }
              const threadForPlayer =
                aliases.map((alias) => threadAliasesMap.get(alias)).find((thread): thread is DirectMessageThreadState => Boolean(thread)) ??
                null;
              const unreadCount = threadForPlayer?.unreadCount ?? 0;
              const isActive = threadForPlayer?.thread.id === activeThreadId;
              const displayLabel = truncateIdentifier(player.displayName ?? player.playerId, 6);

              return (
                <li key={player.playerId}>
                  <button
                    type="button"
                    onClick={() => handleSelectPlayer(player.playerId)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-neutral-800 text-neutral-100 ring-1 ring-amber-400/40"
                        : "text-neutral-300 hover:bg-neutral-900/80 hover:text-neutral-100"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                      <span className="min-w-0 truncate font-medium">{displayLabel}</span>
                    </span>
                    {threadForPlayer ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          unreadCount > 0
                            ? "border border-amber-400/60 text-amber-300"
                            : "border border-neutral-700 text-neutral-400"
                        }`}
                      >
                        {unreadCount > 0 ? unreadCount : "DM"}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">New</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {sortedThreads.length === 0 && <p className="px-1 py-2 text-sm text-neutral-500">No direct messages yet.</p>}
        <ul className="flex flex-col gap-1">
          {sortedThreads.map((thread) => {
            const otherParticipant =
              thread.thread.participants.find((participant: string) => !selfAliases.includes(participant)) ??
              thread.thread.participants[0];
            const isActive = thread.thread.id === activeThreadId;
            const unread = thread.unreadCount;
            const displayLabel = truncateIdentifier(otherParticipant);

            return (
              <li key={thread.thread.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(thread.thread.id)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-neutral-800 text-neutral-100 ring-1 ring-amber-400/40"
                      : "text-neutral-300 hover:bg-neutral-900/80 hover:text-neutral-100"
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{displayLabel}</span>
                  {unread > 0 && (
                    <span className="rounded-full border border-amber-400/60 px-2 py-0.5 text-xs font-semibold text-amber-300">
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
