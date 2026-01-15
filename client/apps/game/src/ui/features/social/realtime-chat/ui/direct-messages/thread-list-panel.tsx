import { useMemo, useState } from "react";

import { useRealtimeChatActions, useRealtimeChatSelector, useRealtimePresence } from "../../hooks/use-realtime-chat";
import type { DirectMessageThreadState } from "../../model/types";
import { UserAvatar } from "../shared/user-avatar";
import { normalizeAvatarUsername, useAvatarProfilesByUsernames } from "@/hooks/use-player-avatar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("realtime-chat-pinned-users");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Select values individually to prevent infinite re-renders
  const threads = useRealtimeChatSelector((state) => state.dmThreads);
  const activeThreadId = useRealtimeChatSelector((state) => state.activeThreadId);
  const identity = useRealtimeChatSelector((state) => state.identity);
  const identityId = identity?.playerId ?? null;
  const identityWallet = identity?.walletAddress ?? null;
  const presence = useRealtimePresence();
  const presenceUsernames = useMemo(
    () => presence.map((player) => player.displayName ?? player.playerId),
    [presence],
  );
  const { data: avatarProfiles } = useAvatarProfilesByUsernames(presenceUsernames);
  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    (avatarProfiles ?? []).forEach((profile) => {
      const normalized = normalizeAvatarUsername(profile.cartridgeUsername ?? undefined);
      if (!normalized) return;
      if (profile.avatarUrl) {
        map.set(normalized, profile.avatarUrl);
      }
    });
    return map;
  }, [avatarProfiles]);

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

  const togglePin = (playerId: string) => {
    setPinnedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      localStorage.setItem("realtime-chat-pinned-users", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filteredPresence = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return presence.filter((player) => {
      if (selfAliases.includes(player.playerId)) return false;
      if (!query) return true;
      const displayName = (player.displayName ?? player.playerId).toLowerCase();
      return displayName.includes(query) || player.playerId.toLowerCase().includes(query);
    });
  }, [presence, selfAliases, searchQuery]);

  const onlinePlayers = useMemo(() => {
    return filteredPresence
      .filter((player) => player.isOnline)
      .sort((a, b) => {
        const aName = a.displayName ?? a.playerId;
        const bName = b.displayName ?? b.playerId;
        return aName.localeCompare(bName);
      });
  }, [filteredPresence]);

  const offlinePlayers = useMemo(() => {
    return filteredPresence
      .filter((player) => !player.isOnline)
      .sort((a, b) => {
        const aName = a.displayName ?? a.playerId;
        const bName = b.displayName ?? b.playerId;
        return aName.localeCompare(bName);
      });
  }, [filteredPresence]);

  const threadsWithUnread = useMemo(() => {
    return sortedThreads.filter((thread) => thread.unreadCount > 0);
  }, [sortedThreads]);

  const handleSelect = (threadId: string) => {
    actions.setActiveThread(threadId);
    onSelectThread?.(threadId);
  };

  const handleSelectPlayer = (playerId: string) => {
    const threadId = actions.openDirectThread(playerId);
    if (threadId) {
      onSelectThread?.(threadId);
    }
  };

  const renderPlayerItem = (player: any, isOffline = false) => {
    const aliases = [player.playerId];
    if (player.walletAddress && !aliases.includes(player.walletAddress)) {
      aliases.push(player.walletAddress);
    }
    const threadForPlayer =
      aliases
        .map((alias) => threadAliasesMap.get(alias))
        .find((thread): thread is DirectMessageThreadState => Boolean(thread)) ?? null;
    const unreadCount = threadForPlayer?.unreadCount ?? 0;
    const isActive = threadForPlayer?.thread.id === activeThreadId;
    const displayLabel = truncateIdentifier(player.displayName ?? player.playerId, 6);
    const isPinned = pinnedUsers.has(player.playerId);

    const normalized = normalizeAvatarUsername(player.displayName ?? player.playerId);
    const avatarUrl = normalized ? avatarMap.get(normalized) : undefined;

    return (
      <li
        key={player.playerId}
        className={`w-full px-2 py-1 text-left hover:bg-gold/20 flex items-center ${isActive ? "bg-gold/30" : ""} ${isOffline ? "opacity-60" : ""}`}
      >
        <button onClick={() => handleSelectPlayer(player.playerId)} className="flex items-center flex-1">
          <UserAvatar name={displayLabel} avatarUrl={avatarUrl} isOnline={!isOffline} size="sm" className="mr-2" />
          <span className="text-sm truncate text-white">{displayLabel}</span>
          {!isOffline && <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />}
          {unreadCount > 0 && (
            <span className="ml-1 animate-pulse bg-red-500 text-white text-xs font-bold px-2 py-0.5 bg-red/30 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePin(player.playerId);
          }}
          className={`ml-2 p-1 rounded hover:bg-gold/20 transition-colors ${isPinned ? "text-gold" : "text-gold/30"}`}
          title={isPinned ? "Unpin user" : "Pin user"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill={isPinned ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>
      </li>
    );
  };

  return (
    <aside className={`flex h-full w-64 flex-col border-r border-gold/30 ${className ?? ""}`}>
      <header className="border-b border-gold/30 px-3 py-3">
        <h2 className="text-sm font-semibold text-gold">Direct Messages</h2>
      </header>
      <div className="px-2 py-2">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 bg-gold/20 border border-gold/30 rounded text-gold placeholder-gold/50 text-sm focus:outline-none focus:border-gold"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {threadsWithUnread.length > 0 && (
          <section className="mb-4">
            <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Unread Messages ({threadsWithUnread.length})
            </h3>
            <ul className="flex flex-col">
              {threadsWithUnread.map((thread) => {
                const otherParticipant =
                  thread.thread.participants.find((participant: string) => !selfAliases.includes(participant)) ??
                  thread.thread.participants[0];
                const player = presence.find((p) => p.playerId === otherParticipant);
                if (player) return renderPlayerItem(player, !player.isOnline);
                return null;
              })}
            </ul>
          </section>
        )}

        {onlinePlayers.length > 0 && (
          <section className="mb-4">
            <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Online Lords ({onlinePlayers.length})
            </h3>
            <ul className="flex flex-col">{onlinePlayers.map((player) => renderPlayerItem(player, false))}</ul>
          </section>
        )}

        {offlinePlayers.length > 0 && (
          <section className="mb-4">
            <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Offline ({offlinePlayers.length})
            </h3>
            <ul className="flex flex-col">{offlinePlayers.map((player) => renderPlayerItem(player, true))}</ul>
          </section>
        )}

        {onlinePlayers.length === 0 && offlinePlayers.length === 0 && (
          <p className="px-1 py-2 text-sm text-gold/50">No players found.</p>
        )}
      </div>
    </aside>
  );
}
