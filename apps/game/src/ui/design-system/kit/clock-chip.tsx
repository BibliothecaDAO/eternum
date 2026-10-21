import { formatClockTime, formatDate, formatDuration } from "@bibliothecadao/types";
import { AppChip } from "./app-elements";
import { Pill } from "./pill";
import { CLOCK_WORDS, LEFT } from "./words";

type ClockPrefix = "starts" | "opens" | "entryOpens" | "ends" | "expires" | "closes";

const DAY = 86_400;
const BEGINS: readonly ClockPrefix[] = ["starts", "opens", "entryOpens"];

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
  if (at !== undefined && isWithinADay(at, now)) return `${word} ${clockAt(at, now)} · ${countdown(prefix, at - now)}`;
  return `${word} ${clockAt(at, now)}`;
};

/** A moment alone, with no time left: its local clock time within a day ("16:30"), else its date too ("14 Oct, 18:00"). */
export const clockAt = (at: number | undefined, now: number): string =>
  at === undefined || isWithinADay(at, now) ? formatClockTime(at) : `${formatDate(at, now)}, ${formatClockTime(at)}`;

type ClockMoment = { prefix: ClockPrefix | null; at: number | undefined; now: number };

/** A moment's icon: the hourglass within a day, the calendar further out or for a finished game's date. */
const clockIcon = ({ prefix, at, now }: ClockMoment) =>
  prefix !== null && at !== undefined && isWithinADay(at, now) ? "hourglass" : "calendar";

/** A moment as the shell kit's chip. */
export const ClockChip = (moment: ClockMoment) => (
  <Pill icon={clockIcon(moment)}>{clockLine(moment.prefix, moment.at, moment.now)}</Pill>
);

/** A moment as the app sheet's chip. */
export const AppClockChip = (moment: ClockMoment) => (
  <AppChip icon={clockIcon(moment)}>{clockLine(moment.prefix, moment.at, moment.now)}</AppChip>
);
