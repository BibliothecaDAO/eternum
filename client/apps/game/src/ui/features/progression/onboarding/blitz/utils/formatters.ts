/**
 * Format a Unix timestamp to a localized date/time string
 */
export const formatLocalDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format seconds remaining into a countdown string
 * e.g., "2d 05:30:15" or "05:30:15"
 */
export { formatCountdown } from "@bibliothecadao/react";

/**
 * Format a token amount with decimals (default 18)
 */
export const formatTokenAmount = (value: bigint, decimals: bigint = 18n): string => {
  return (value / 10n ** decimals).toString();
};

/**
 * Format a large number with K/M/B suffixes
 */
export const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};
