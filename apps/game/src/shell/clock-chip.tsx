import { CalendarDays, Hourglass } from "@/ui/design-system/atoms/game-icons";
import { formatClockTime, formatDate, formatDuration } from "@/ui/design-system/kit/time";
import { LEFT } from "@/ui/design-system/kit/words";

import { CLOCK_WORDS } from "./words";

type ClockPrefix = "starts" | "opens" | "ends" | "expires";

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

/** A post or guide's day, written "2025-01-13" in the bundled content, as the device's local day ("13 Jan 2025"). */
export const formatContentDay = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  return formatDate(new Date(year, month - 1, date).getTime() / 1000);
};

/** A moment as a chip: the hourglass within a day, the calendar further out or for a finished game's date. */
export const ClockChip = ({ prefix, at, now }: { prefix: ClockPrefix | null; at: number | undefined; now: number }) => {
  const Icon = prefix !== null && at !== undefined && isWithinADay(at, now) ? Hourglass : CalendarDays;
  return (
    <span className="frontier-chip h-8 shrink-0 whitespace-nowrap !py-0 !pl-1.5 !pr-3 font-ui text-[14px] font-bold text-kit-cream">
      <Icon size={20} />
      {clockLine(prefix, at, now)}
    </span>
  );
};
