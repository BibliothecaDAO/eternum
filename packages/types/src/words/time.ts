/**
 * The one way to write a time a player reads: a duration, a wait, a countdown, a moment on the device's local clock, a
 * day, and how long ago something was. Unknown is a dash.
 */

const DASH = "—";
/** A moment just gone, and how long ago one was: "just now", "5m ago" (formatAgo). */
const JUST_NOW = "just now";
const AGO = "ago";

/**
 * A duration as "3d 4h", "7h 14m", "12h" or "42m", counted up to the next whole minute so time still left never reads
 * 0m. Frontier passes `{ days: false }`: its days run 8 to 24 hours, so a count of 24-hour days would misread there, and
 * its durations stay in hours ("30h").
 */
export const formatDuration = (seconds: number | undefined, { days = true } = {}): string => {
  if (seconds === undefined) return DASH;
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (days && hours >= 24) {
    // Past a day the minutes go, rounded into the hour, as they are rounded into the minute below.
    const wholeHours = Math.ceil(minutes / 60);
    const left = wholeHours % 24;
    return left === 0 ? `${wholeHours / 24}d` : `${Math.floor(wholeHours / 24)}d ${left}h`;
  }
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/**
 * A duration in three characters at most, where a glance is all that fits (a resource ring's rim): `formatDuration`'s
 * first unit, "42m", "7h", "12d", then weeks past 99 days ("14w") and years past 99 weeks ("2y"). Past 99 years it
 * reads "99y+": more than that, never a smaller number. The full duration is written where there is room.
 */
export const formatShortDuration = (seconds: number): string => {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  // Past a day the minutes go, rounded into the hour, as formatDuration rounds them.
  const days = Math.floor(Math.ceil(minutes / 60) / 24);
  if (days < 100) return `${days}d`;
  if (days < 700) return `${Math.floor(days / 7)}w`;
  const years = Math.floor(days / 365);
  return years < 100 ? `${years}y` : "99y+";
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

/**
 * The top bar's game clock, read to the second: "1h 12m 08s", "1m 08s", "1d 01h 0m 00s"; compact on a phone, without the
 * seconds past an hour ("1h 12m", "1d 1h"). Never below zero.
 */
export const formatGameClock = (seconds: number, { compact = false } = {}): string => {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const minuteSecond = `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
  if (compact && days > 0) return `${days}d ${hours}h`;
  if (compact && hours > 0) return `${hours}h ${minutes}m`;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h ${minuteSecond}`;
  return hours > 0 ? `${hours}h ${minuteSecond}` : minuteSecond;
};

/** A countdown read to the second, hours, minutes and seconds: "2:04:12"; never below zero. */
export const formatCountdown = (seconds: number): string => {
  const left = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${Math.floor(left / 3600)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
};

/**
 * How long ago a moment was (unix seconds): "just now" under ten seconds, then "24s ago", "5m ago", "3h ago", and from
 * a day back its date ("7 Oct"), which says more than a count of days.
 */
export const formatAgo = (unixSeconds: number | undefined, nowSeconds = Date.now() / 1000): string => {
  if (unixSeconds === undefined) return DASH;
  const elapsed = Math.max(0, Math.floor(nowSeconds - unixSeconds));
  if (elapsed < 10) return JUST_NOW;
  if (elapsed < 60) return `${elapsed}s ${AGO}`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${AGO}`;
  if (elapsed < 86_400) return `${Math.floor(elapsed / 3600)}h ${AGO}`;
  return formatDate(unixSeconds, nowSeconds);
};
