import {
  differenceInSeconds,
  formatDistanceToNow,
  fromUnixTime,
  getUnixTime,
} from "date-fns";

export const WEEK_IN_SECONDS = 7 * 24 * 60 * 60; // 1 week in seconds
export const YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 1 year in seconds

export function toTime(time: number | string | undefined) {
  return Number(time ?? 0);
}

export function getTimeUntil(time?: number): number {
  if (!time) return 0;
  const duration = differenceInSeconds(fromUnixTime(time), new Date());
  return Math.max(duration, 0);
}

export function toWeeks(time?: number): number {
  return Math.floor(toTime(time) / WEEK_IN_SECONDS);
}

export function roundToWeek(time: number) {
  return Math.floor(toTime(time) / WEEK_IN_SECONDS) * WEEK_IN_SECONDS;
}
export function formatLockEndTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
}
