import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  // If the string is short enough, don't shorten it
  if (string.length <= 10) {
    return string;
  }
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const trimAddress = (addr?: string): string => {
  if (!addr || !addr.startsWith("0x")) return addr || "";
  return "0x" + addr.slice(2).replace(/^0+/, "");
};

export const padAddress = (addr?: string): string => {
  if (!addr) return "";
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return "0x" + hex.padStart(64, "0");
};

// Format relative time (e.g. "5 minutes ago", "2 hours ago", etc.)
export function formatRelativeTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return "N/A";

  // Convert to date objects for both timestamps
  const date = new Date(Number(timestamp) * 1000); // Convert from seconds to milliseconds
  const now = new Date();

  // Calculate time difference in milliseconds
  const diffMs = date.getTime() - now.getTime(); // Changed to future - now
  const seconds = Math.abs(Math.floor(diffMs / 1000));
  const isFuture = diffMs > 0;

  if (seconds < 60) return isFuture ? `in ${seconds} seconds` : `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return isFuture
      ? `in ${minutes} minute${minutes === 1 ? "" : "s"}`
      : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return isFuture ? `in ${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return isFuture ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4)
    return isFuture ? `in ${weeks} week${weeks === 1 ? "" : "s"}` : `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return isFuture ? `in ${months} month${months === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"} ago`;
}
