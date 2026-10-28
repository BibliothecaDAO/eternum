/**
 * Quiet hours, 22:00 to 08:00 on the phone's own clock: no game push wakes a player. A phone whose time zone is not
 * known yet (it reports it each time the game is open) has none, and its times read in UTC.
 */
const QUIET_FROM_HOUR = 22;
const MORNING_HOUR = 8;

/** The device's hour and minute at an instant; UTC when its zone is unknown. */
const localClock = (at: number, timeZone: string | null): { hour: number; minute: number; second: number } => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone ?? "UTC",
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(at));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { hour: part("hour"), minute: part("minute"), second: part("second") };
};

export const isQuietAt = (at: number, timeZone: string | null): boolean => {
  if (timeZone === null) return false;
  const { hour } = localClock(at, timeZone);
  return hour >= QUIET_FROM_HOUR || hour < MORNING_HOUR;
};

/**
 * When a push due at `at` may go: then, or 08:00 on the phone's clock if `at` falls in its quiet hours. The clock may
 * change its offset overnight (daylight saving), so the guess is corrected until the phone reads 08:00.
 */
export const sendableAt = (at: number, timeZone: string | null): number => {
  if (!isQuietAt(at, timeZone)) return at;
  const { hour } = localClock(at, timeZone);
  let morning = at + ((MORNING_HOUR - hour + 24) % 24) * 3_600_000;
  for (let step = 0; step < 3; step++) {
    const correction = fromMorning(morning, timeZone);
    if (correction === 0) break;
    morning += correction;
  }
  return morning;
};

/** How far `at` is from 08:00 on the phone's clock that day: positive before it, negative after. */
const fromMorning = (at: number, timeZone: string | null): number => {
  const { hour, minute, second } = localClock(at, timeZone);
  return ((MORNING_HOUR - hour) * 60 - minute) * 60_000 - second * 1000 - (at % 1000);
};

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
