import React from "react";

interface UserAvatarProps {
  name: string;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ name, isOnline = false, size = "sm", className = "" }) => {
  const initial = ((name || "?").charAt(0) || "?").toUpperCase();

  const sizeClasses = {
    sm: "h-6 w-6 text-sm",
    md: "h-8 w-8 text-base",
    lg: "h-10 w-10 text-lg",
  };

  return (
    <div
      className={`flex items-center justify-center ${sizeClasses[size]} ${
        isOnline
          ? "bg-gradient-to-br from-orange-500/30 to-orange-600/30"
          : "bg-gradient-to-br from-gray-500/30 to-gray-600/30"
      } rounded ${className}`}
    >
      {initial}
    </div>
  );
};
