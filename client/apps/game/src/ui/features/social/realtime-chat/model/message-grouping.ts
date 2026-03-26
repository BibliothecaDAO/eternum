const TWO_MINUTES_MS = 2 * 60 * 1000;

interface GroupableMessage {
  id: string;
  senderId?: string;
  sender?: { playerId: string };
  createdAt: string | Date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function getSenderId(msg: GroupableMessage): string {
  return msg.senderId ?? msg.sender?.playerId ?? "";
}

export function computeGroupFlags(messages: GroupableMessage[]): boolean[] {
  return messages.map((msg, i) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    if (getSenderId(msg) !== getSenderId(prev)) return true;
    const gap = toDate(msg.createdAt).getTime() - toDate(prev.createdAt).getTime();
    return gap > TWO_MINUTES_MS;
  });
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
        label = currDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
      }
      separators.set(i, label);
    }
  }

  return separators;
}
