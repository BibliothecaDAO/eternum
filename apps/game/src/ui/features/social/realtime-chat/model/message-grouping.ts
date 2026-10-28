import { formatClockTime, formatDate } from "@bibliothecadao/types";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The UTC day a message was sent, as that day's midnight in milliseconds. */
function dayOf(value: string | Date): number {
  const date = toDate(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** A UTC day's name: Today, Yesterday, or its date. */
function dayName(dayUTC: number): string {
  const todayUTC = dayOf(new Date());
  if (dayUTC === todayUTC) return "Today";
  if (dayUTC === todayUTC - 86400000) return "Yesterday";
  // The chat's day is its UTC day; that day's noon reads as it in every zone within twelve hours of UTC.
  return formatDate((dayUTC + 43_200_000) / 1000);
}

/** The day line above each day's first message, keyed by its index: the oldest message's day included. */
export function computeDateSeparators(messages: { id: string; createdAt: string | Date }[]): Map<number, string> {
  const separators = new Map<number, string>();
  for (let i = 0; i < messages.length; i++) {
    const currDayUTC = dayOf(messages[i].createdAt);
    if (i === 0 || dayOf(messages[i - 1].createdAt) !== currDayUTC) separators.set(i, dayName(currDayUTC));
  }
  return separators;
}

/** When a message was sent, as a list of conversations shows it: its time today, its day before. */
export function whenSent(value: string | Date): string {
  const day = dayOf(value);
  return day === dayOf(new Date()) ? formatClockTime(toDate(value).getTime() / 1000) : dayName(day);
}
