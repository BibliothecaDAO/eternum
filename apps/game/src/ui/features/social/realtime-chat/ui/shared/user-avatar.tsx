import React from "react";

import { playerAvatarUrl } from "@/hooks/use-player-profile";

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
    sm: "h-6 w-6 text-hud-body",
    md: "h-8 w-8 text-hud-body",
    lg: "h-10 w-10 text-hud-title",
  };

  const resolvedAvatarUrl = address ? (avatarUrl ?? playerAvatarUrl(address)) : (avatarUrl ?? null);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${sizeClasses[size]} ${
        isOnline ? " " : " "
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
