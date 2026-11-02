/** "20:00" on the phone's clock, or "20:00 UTC" when its zone is not known. */
export const clockTime = (at: number, timeZone: string | null): string => {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone ?? "UTC",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
  return timeZone === null ? `${time} UTC` : time;
};

/** A time zone the phone named, kept only if this runtime knows it. */
export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
