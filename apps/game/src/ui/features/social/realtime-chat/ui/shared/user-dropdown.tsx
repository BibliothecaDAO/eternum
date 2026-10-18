import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import React, { useState, useMemo } from "react";
import type { PlayerPresence } from "../../model/types";
import { UserAvatar } from "./user-avatar";

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

  const renderUserItem = (user: PlayerPresence, isOffline = false) => {
    const displayLabel = user.displayName ?? user.playerId;
    const isPinned = pinnedUsers.has(user.playerId);
    const unreadCount = threadsWithUnread.get(user.playerId) ?? 0;
    return (
      <li
        key={user.playerId}
        className={`w-full px-2 py-1 text-left hover:bg-hud-chosen flex items-center ${isOffline ? "opacity-60" : ""}`}
      >
        <button onClick={() => onUserSelect(user.playerId)} className="flex items-center flex-1">
          <UserAvatar name={displayLabel} address={user.playerId} isOnline={!isOffline} size="sm" className="mr-2" />
          <span className="text-hud-body truncate text-hud-ink">{displayLabel}</span>
          {!isOffline && <div className="ml-auto w-2 h-2 bg-green-500 rounded-full" />}
          {unreadCount > 0 && (
            <span className="ml-1 animate-pulse bg-red-500 text-hud-ink text-hud-label px-2 py-0.5 bg-red/30 rounded-full">
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
            className={`ml-2 p-1 rounded hover:bg-hud-chosen transition-colors ${isPinned ? "text-hud-accent" : "text-hud-cue"}`}
            title={isPinned ? "Unpin user" : "Pin user"}
          >
            <SemanticIcon name="pin" className={`h-3 w-3 ${isPinned ? "opacity-100" : "opacity-40"}`} />
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
      className={`user-dropdown absolute top-full left-0 mt-1 w-64 max-h-[400px] bg-hud-well border border-hud-line rounded shadow-lg z-50 overflow-hidden ${className}`}
    >
      <div className="px-2 py-2 border-b border-hud-line">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 bg-hud-chosen border border-hud-line rounded text-hud-accent placeholder-gold/50 text-hud-body focus:outline-none focus:border-hud-line-strong"
        />
      </div>

      <div className="overflow-y-auto max-h-[320px]">
        {usersWithUnread.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-hud-label uppercase tracking-wide text-hud-muted">
              Unread Messages ({usersWithUnread.length})
            </h3>
            <ul className="flex flex-col">{usersWithUnread.map((user) => renderUserItem(user, !user.isOnline))}</ul>
          </section>
        )}

        {onlineUsers.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-hud-label uppercase tracking-wide text-hud-muted">
              Online Lords ({onlineUsers.length})
            </h3>
            <ul className="flex flex-col">{onlineUsers.map((user) => renderUserItem(user, false))}</ul>
          </section>
        )}

        {offlineUsers.length > 0 && (
          <section className="mb-2 px-2 py-2">
            <h3 className="px-1 pb-1 text-hud-label uppercase tracking-wide text-hud-muted">
              Offline ({offlineUsers.length})
            </h3>
            <ul className="flex flex-col">{offlineUsers.map((user) => renderUserItem(user, true))}</ul>
          </section>
        )}

        {filteredUsers.length === 0 && (
          <p className="px-3 py-4 text-hud-body text-hud-cue text-center">No users found.</p>
        )}
      </div>
    </div>
  );
};
