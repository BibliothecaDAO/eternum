import React from "react";

interface UserItemProps {
  user: {
    id: string;
    username?: string;
  };
  isOffline: boolean;
  unreadCount: number;
  isSelected: boolean;
  isPinned: boolean;
  onSelect: (userId: string) => void;
  onTogglePin: (userId: string) => void;
}

const UserItem: React.FC<UserItemProps> = ({
  user,
  isOffline,
  unreadCount,
  isSelected,
  isPinned,
  onSelect,
  onTogglePin,
}) => {
  return (
    <div
      className={`w-full px-2 py-1 text-left hover:bg-gold/20 flex items-center ${
        isSelected ? "bg-gold/30" : ""
      } ${isOffline ? "opacity-60" : ""}`}
    >
      <button onClick={() => onSelect(user.id)} className="flex items-center flex-1">
        <div
          className={`h-6 w-6 flex items-center justify-center text-sm ${
            isOffline
              ? "bg-gradient-to-br from-gray-500/30 to-gray-600/30"
              : "bg-gradient-to-br from-orange-500/30 to-orange-600/30"
          } mr-2 rounded`}
        >
          {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
        </div>
        <span className={`text-sm truncate ${isOffline ? "" : ""}`}>{user.username || user.id}</span>
        {!isOffline && <div className="ml-auto w-2 h-2 bg-green-500 rounded-full"></div>}
        {unreadCount > 0 && (
          <span className="ml-1 animate-pulse bg-red-500 text-white text-xs font-bold px-2 py-0.5 bg-red/30 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(user.id);
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
    </div>
  );
};

export default UserItem;
