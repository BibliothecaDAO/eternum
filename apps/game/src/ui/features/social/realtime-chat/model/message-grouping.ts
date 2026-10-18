import { formatDate } from "@bibliothecadao/types";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function computeDateSeparators(messages: { id: string; createdAt: string | Date }[]): Map<number, string> {
  const separators = new Map<number, string>();
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterdayUTC = todayUTC - 86400000;

  for (let i = 1; i < messages.length; i++) {
    const prevDate = toDate(messages[i - 1].createdAt);
    const currDate = toDate(messages[i].createdAt);
    const prevDayUTC = Date.UTC(prevDate.getUTCFullYear(), prevDate.getUTCMonth(), prevDate.getUTCDate());
    const currDayUTC = Date.UTC(currDate.getUTCFullYear(), currDate.getUTCMonth(), currDate.getUTCDate());

    if (prevDayUTC !== currDayUTC) {
      let label: string;
      if (currDayUTC === todayUTC) {
        label = "Today";
      } else if (currDayUTC === yesterdayUTC) {
        label = "Yesterday";
      } else {
        // The chat's day is its UTC day; that day's noon reads as it in every zone within twelve hours of UTC.
        label = formatDate((currDayUTC + 43_200_000) / 1000);
      }
      separators.set(i, label);
    }
  }

  return separators;
}
