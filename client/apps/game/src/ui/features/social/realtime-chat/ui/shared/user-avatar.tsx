import React from "react";

import { getAvatarUrl } from "@/hooks/use-player-avatar";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  address?: string | null;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  address,
  isOnline = false,
  size = "sm",
  className = "",
}) => {
  const initial = ((name || "?").charAt(0) || "?").toUpperCase();

  const sizeClasses = {
    sm: "h-6 w-6 text-sm",
    md: "h-8 w-8 text-base",
    lg: "h-10 w-10 text-lg",
  };

  const resolvedAvatarUrl = address ? getAvatarUrl(address, avatarUrl ?? undefined) : avatarUrl ?? null;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${sizeClasses[size]} ${
        isOnline
          ? "bg-gradient-to-br from-orange-500/30 to-orange-600/30"
          : "bg-gradient-to-br from-gray-500/30 to-gray-600/30"
      } rounded ${className}`}
    >
      {resolvedAvatarUrl ? (
        <img className="h-full w-full object-cover" src={resolvedAvatarUrl} alt={`${name} avatar`} />
      ) : (
        initial
      )}
    </div>
  );
};
