/**
 * The kit's one way to write time. Days run 8 to 24 hours, so a duration is hours and minutes and never days; a moment is
 * the device's local clock time. Unknown is a dash.
 */

const DASH = "—";

/** A duration as "7h 14m", "12h" or "42m", counted up to the next whole minute so time still left never reads 0m. */
export const formatDuration = (seconds: number | undefined): string => {
  if (seconds === undefined) return DASH;
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/**
 * A short wait read to the second while it is under ten minutes, "24s" or "2m 10s"; longer, as a duration. Stamina comes
 * back by the second, so the second it is ready is the one a player waits for.
 */
export const formatWait = (seconds: number): string => {
  const left = Math.max(0, Math.ceil(seconds));
  if (left >= 600) return formatDuration(left);
  const minutes = Math.floor(left / 60);
  const rest = left % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
};

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A moment (unix seconds) as the device's local clock time, "21:40". */
export const formatClockTime = (unixSeconds: number | undefined): string =>
  unixSeconds === undefined ? DASH : CLOCK.format(new Date(unixSeconds * 1000));

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A day (unix seconds) as the device's local "7 Oct", with the year only when it is not this year's. */
export const formatDate = (unixSeconds: number | undefined, nowSeconds = Date.now() / 1000): string => {
  if (unixSeconds === undefined) return DASH;
  const date = new Date(unixSeconds * 1000);
  const sameYear = date.getFullYear() === new Date(nowSeconds * 1000).getFullYear();
  return (sameYear ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
};

/**
 * A moment a day or more away (unix seconds) as its local day and clock time, "11 Oct 14:32": a clock time alone
 * would read as already past once that time has gone by today.
 */
export const formatMoment = (unixSeconds: number | undefined, nowSeconds = Date.now() / 1000): string =>
  unixSeconds === undefined ? DASH : `${formatDate(unixSeconds, nowSeconds)} ${formatClockTime(unixSeconds)}`;

/** A post or guide's day, written "2025-01-13" in the bundled content, as the device's local day ("13 Jan 2025"). */
export const formatContentDay = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  return formatDate(new Date(year, month - 1, date).getTime() / 1000);
};

/** A countdown read to the second, hours, minutes and seconds: "2:04:12"; never below zero. */
export const formatCountdown = (seconds: number): string => {
  const left = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${Math.floor(left / 3600)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
};
