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

const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A moment (unix seconds) as the device's local clock time, "21:40". */
export const formatClockTime = (unixSeconds: number | undefined): string =>
  unixSeconds === undefined ? DASH : CLOCK.format(new Date(unixSeconds * 1000));
