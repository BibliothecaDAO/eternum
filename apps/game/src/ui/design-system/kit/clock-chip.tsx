import { Pill } from "./pill";
import { formatClockTime, formatDate, formatDuration } from "./time";
import { CLOCK_WORDS, LEFT } from "./words";

type ClockPrefix = "starts" | "opens" | "ends" | "expires" | "closes";

const DAY = 86_400;
const BEGINS: readonly ClockPrefix[] = ["starts", "opens"];

/** Within a day, the clock time and the time left ("Starts 16:30 · in 2h 4m", "Ends 17:30 · 38m left"). */
const isWithinADay = (at: number, now: number) => at >= now && at - now < DAY;

const countdown = (prefix: ClockPrefix, seconds: number) =>
  BEGINS.includes(prefix) ? `${CLOCK_WORDS.in} ${formatDuration(seconds)}` : `${formatDuration(seconds)} ${LEFT}`;

/**
 * The app's one time line (the kit's clock and duration underneath). A moment within a day reads as its local clock
 * time and the time left; further out, its date and time ("Opens 14 Oct, 18:00"); a finished game, its date alone
 * ("7 Oct"). Frontier days run 8 to 24 hours, so the line never says "tonight" or "24h". Unknown is a dash.
 */
export const clockLine = (prefix: ClockPrefix | null, at: number | undefined, now: number): string => {
  if (prefix === null) return formatDate(at, now);
  const word = CLOCK_WORDS[prefix];
  if (at === undefined) return `${word} ${formatClockTime(undefined)}`;
  if (isWithinADay(at, now)) return `${word} ${formatClockTime(at)} · ${countdown(prefix, at - now)}`;
  return `${word} ${formatDate(at, now)}, ${formatClockTime(at)}`;
};

/** A moment as a chip: the hourglass within a day, the calendar further out or for a finished game's date. */
export const ClockChip = ({ prefix, at, now }: { prefix: ClockPrefix | null; at: number | undefined; now: number }) => {
  const icon = prefix !== null && at !== undefined && isWithinADay(at, now) ? "hourglass" : "calendar";
  return <Pill icon={icon}>{clockLine(prefix, at, now)}</Pill>;
};
