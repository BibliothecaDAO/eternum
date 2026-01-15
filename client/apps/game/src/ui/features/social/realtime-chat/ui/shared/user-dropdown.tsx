import React, { useState, useMemo } from "react";
import type { PlayerPresence } from "../../model/types";
import { UserAvatar } from "./user-avatar";
import { normalizeAvatarUsername, useAvatarProfilesByUsernames } from "@/hooks/use-player-avatar";

interface UserDropdownProps {
  users: PlayerPresence[];
  onUserSelect: (userId: string) => void;
  onClose: () => void;
  pinnedUsers?: Set<string>;
  onTogglePin?: (userId: string) => void;
  threadsWithUnread?: Map<string, number>; // userId -> unreadCount
  className?: string;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({
  users,
  onUserSelect,
  onClose,
  pinnedUsers = new Set(),
  onTogglePin,
  threadsWithUnread = new Map(),
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return users.filter((user) => {
      if (!query) return true;
      const displayName = (user.displayName ?? user.playerId).toLowerCase();
      return displayName.includes(query) || user.playerId.toLowerCase().includes(query);
    });
  }, [users, searchQuery]);

  const { usersWithUnread, onlineUsers, offlineUsers } = useMemo(() => {
    const withUnread = filteredUsers.filter((user) => (threadsWithUnread.get(user.playerId) ?? 0) > 0);
    const online = filteredUsers.filter((user) => user.isOnline);
    const offline = filteredUsers.filter((user) => !user.isOnline);
    return { usersWithUnread: withUnread, onlineUsers: online, offlineUsers: offline };
  }, [filteredUsers, threadsWithUnread]);

  const usernames = useMemo(
    () => filteredUsers.map((user) => user.displayName ?? user.playerId),
    [filteredUsers],
  );
  const { data: avatarProfiles } = useAvatarProfilesByUsernames(usernames);
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

  const renderUserItem = (user: PlayerPresence, isOffline = false) => {
    const displayLabel = user.displayName ?? user.playerId;
    const isPinned = pinnedUsers.has(user.playerId);
    const unreadCount = threadsWithUnread.get(user.playerId) ?? 0;
    const normalized = normalizeAvatarUsername(user.displayName ?? user.playerId);
    const avatarUrl = normalized ? avatarMap.get(normalized) : undefined;

    return (
      <li
        key={user.playerId}
        className={`w-full px-2 py-1 text-left hover:bg-gold/20 flex items-center ${isOffline ? "opacity-60" : ""}`}
      >
        <button onClick={() => onUserSelect(user.playerId)} className="flex items-center flex-1">
          <UserAvatar name={displayLabel} avatarUrl={avatarUrl} isOnline={!isOffline} size="sm" className="mr-2" />
          <span className="text-sm truncate text-white">{displayLabel}</span>
          {!isOffline && <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />}
          {unreadCount > 0 && (
            <span className="ml-1 animate-pulse bg-red-500 text-white text-xs font-bold px-2 py-0.5 bg-red/30 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(user.playerId);
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
        )}
      </li>
    );
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".user-dropdown")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      className={`user-dropdown absolute top-full left-0 mt-1 w-64 max-h-[400px] bg-brown/95 border border-gold/30 rounded shadow-lg z-50 overflow-hidden ${className}`}
    >
      <div className="px-2 py-2 border-b border-gold/30">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 bg-gold/20 border border-gold/30 rounded text-gold placeholder-gold/50 text-sm focus:outline-none focus:border-gold"
        />
      </div>

      <div className="overflow-y-auto max-h-[320px]">
        {usersWithUnread.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Unread Messages ({usersWithUnread.length})
            </h3>
            <ul className="flex flex-col">{usersWithUnread.map((user) => renderUserItem(user, !user.isOnline))}</ul>
          </section>
        )}

        {onlineUsers.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Online Lords ({onlineUsers.length})
            </h3>
            <ul className="flex flex-col">{onlineUsers.map((user) => renderUserItem(user, false))}</ul>
          </section>
        )}

        {offlineUsers.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold/70">
              Offline ({offlineUsers.length})
            </h3>
            <ul className="flex flex-col">{offlineUsers.map((user) => renderUserItem(user, true))}</ul>
          </section>
        )}

        {filteredUsers.length === 0 && <p className="px-3 py-4 text-sm text-gold/50 text-center">No users found.</p>}
      </div>
    </div>
  );
};
