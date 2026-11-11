import type { Tone } from "@/ui/design-system/kit/tone";
import { dayOf, type SeasonCalendar } from "@bibliothecadao/eternum";

/** The last hour turns the dial and the clock line ember. */
const LAST_HOUR_SECONDS = 3_600;

/** What the dial and the clock line show; every field is undefined outside the season. */
export type DayClock = {
  /** One-based, as the player counts days. */
  day: number | undefined;
  endsAt: number | undefined;
  secondsLeft: number | undefined;
  tomorrowSeconds: number | undefined;
  shareLeft: number | undefined;
  tone: Tone;
};

/**
 * The next day's number, one-based as the player counts days; null when the season ends with today (its last day,
 * however its final stub was cut or merged) or is not running.
 */
export const nextDayOf = (calendar: SeasonCalendar, now: number): number | null => {
  const today = dayOf(calendar, now);
  const tomorrow = today && dayOf(calendar, today.end);
  return tomorrow ? tomorrow.index + 1 : null;
};

/** The dial and the clock line turn ember in today's last hour. */
export const dayTone = (secondsLeft: number): Tone => (secondsLeft <= LAST_HOUR_SECONDS ? "ember" : "calm");

/** The last ten minutes, when the day end's line turns from a warning to an alarm. */
const FINAL_MINUTES_SECONDS = 600;

/** The day end's line in the last hour: a warning, then red in its last ten minutes. */
export const dayEndUrgency = (secondsLeft: number): "warn" | "bad" =>
  secondsLeft <= FINAL_MINUTES_SECONDS ? "bad" : "warn";

const OUTSIDE_THE_SEASON: DayClock = {
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
  if (!today) return OUTSIDE_THE_SEASON;
  const tomorrow = dayOf(calendar, today.end);
  const secondsLeft = today.end - now;
  return {
    day: today.index + 1,
    endsAt: today.end,
    secondsLeft,
    tomorrowSeconds: tomorrow ? tomorrow.end - tomorrow.start : undefined,
    shareLeft: secondsLeft / (today.end - today.start),
    tone: dayTone(secondsLeft),
  };
};

/**
 * Where today stands in the season (audit 10-27: its end and the days left were shown nowhere): today's number and the
 * season's last day, both one-based as the player counts them; undefined outside the season.
 */
export const seasonDay = (calendar: SeasonCalendar, now: number): { day: number; lastDay: number } | undefined => {
  const today = dayOf(calendar, now);
  const last = dayOf(calendar, calendar.endAt - 1);
  return today && last ? { day: today.index + 1, lastDay: last.index + 1 } : undefined;
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
  let found = dayOf(calendar, Math.min(now, calendar.endAt - 1));
  if (!found || day < 1 || day > found.index + 1) return null;
  while (found.index + 1 > day) {
    const before: { index: number; start: number; end: number } | null = dayOf(calendar, found.start - 1);
    if (!before) return null;
    found = before;
  }
  return { start: found.start, end: found.end };
};

/**
 * The day the day-done card recaps: the last ended day the player acted in, from the times of their own stories (unix
 * seconds), so a day they skipped does not hide one they played (owner, 10 Nov 2026: "I played day 1 but not day 2, its
 * day 3 now"); the day that ended last when they acted in none. Null when no day has ended.
 */
export const dayToRecap = (
  calendar: SeasonCalendar,
  now: number,
  actedAt: readonly number[],
): { day: number; start: number; end: number } | null => {
  const ended = endedDay(calendar, now);
  if (!ended) return null;
  const lastAct = actedAt.reduce((last, at) => (at < ended.end && at > last ? at : last), Number.NEGATIVE_INFINITY);
  const played = Number.isFinite(lastAct) ? dayOf(calendar, lastAct) : null;
  return played ? { day: played.index + 1, start: played.start, end: played.end } : ended;
};

/**
 * The day that ended last: its number and its bounds in unix seconds, for the day-done card's totals. Null on the
 * season's first day, which follows no day, and after the season, when no new day opens.
 */
export const endedDay = (calendar: SeasonCalendar, now: number): { day: number; start: number; end: number } | null => {
  const today = dayOf(calendar, now);
  const bounds = today && today.index > 0 ? dayBounds(calendar, now, today.index) : null;
  return today && bounds ? { day: today.index, ...bounds } : null;
};
