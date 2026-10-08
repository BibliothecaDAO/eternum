import type { Tone } from "@/ui/design-system/kit/tone";
import { dayOf, type SeasonCalendar } from "@bibliothecadao/eternum";

/** The last hour turns the dial and the clock line ember. */
const LAST_HOUR_SECONDS = 3_600;

/** What the dial and the clock line show; every field is undefined before the season's first day. */
export type DayClock = {
  /** One-based, as the player counts days. */
  day: number | undefined;
  endsAt: number | undefined;
  secondsLeft: number | undefined;
  tomorrowSeconds: number | undefined;
  shareLeft: number | undefined;
  tone: Tone;
};

const BEFORE_THE_SEASON: DayClock = {
  day: undefined,
  endsAt: undefined,
  secondsLeft: undefined,
  tomorrowSeconds: undefined,
  shareLeft: undefined,
  tone: "calm",
};

/**
 * Today on the season's calendar (core's dayOf, the contract's day bags): when it ends, the time left, the share of
 * today still to run, and how long tomorrow lasts. The shell draws it from the directory's calendar too.
 */
export const dayClock = (calendar: SeasonCalendar, now: number): DayClock => {
  const today = dayOf(calendar, now);
  if (!today) return BEFORE_THE_SEASON;
  const tomorrow = dayOf(calendar, today.end);
  const secondsLeft = today.end - now;
  return {
    day: today.index + 1,
    endsAt: today.end,
    secondsLeft,
    tomorrowSeconds: tomorrow ? tomorrow.end - tomorrow.start : undefined,
    shareLeft: secondsLeft / (today.end - today.start),
    tone: secondsLeft <= LAST_HOUR_SECONDS ? "ember" : "calm",
  };
};

/**
 * A season day's bounds in unix seconds, one-based as the player counts it, found by stepping back from today; null
 * before the season or for a day not yet begun.
 */
export const dayBounds = (
  calendar: SeasonCalendar,
  now: number,
  day: number,
): { start: number; end: number } | null => {
  let found = dayOf(calendar, now);
  if (!found || day < 1 || day > found.index + 1) return null;
  while (found.index + 1 > day) {
    const before: { index: number; start: number; end: number } | null = dayOf(calendar, found.start - 1);
    if (!before) return null;
    found = before;
  }
  return { start: found.start, end: found.end };
};

/**
 * The day that ended last: its number and its bounds in unix seconds, for the day-done card's totals. Null on the
 * season's first day, which follows no day.
 */
export const endedDay = (calendar: SeasonCalendar, now: number): { day: number; start: number; end: number } | null => {
  const today = dayOf(calendar, now);
  const bounds = today && today.index > 0 ? dayBounds(calendar, now, today.index) : null;
  return today && bounds ? { day: today.index, ...bounds } : null;
};
