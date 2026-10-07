import type { Tone } from "@/ui/design-system/kit/tone";
import { expeditionDayEndsAt, type readExpeditionRules, seasonDay } from "@bibliothecadao/eternum";

/** The clock needs only the day length and the season's start, so the shell can draw it from the directory too. */
type ExpeditionRules = Pick<NonNullable<ReturnType<typeof readExpeditionRules>>, "epochSeconds" | "startMainAt">;

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

/**
 * Today on the game's clock. Every day on next lasts the preset's epoch, so tomorrow lasts as long as today; the day
 * bag's varied lengths arrive with packages/core/src/utils/days.ts (dayOf) and replace these three reads.
 */
export const dayClock = (rules: ExpeditionRules, now: number): DayClock => {
  const day = seasonDay(rules, now);
  if (day === null) {
    return {
      day: undefined,
      endsAt: undefined,
      secondsLeft: undefined,
      tomorrowSeconds: undefined,
      shareLeft: undefined,
      tone: "calm",
    };
  }
  const endsAt = expeditionDayEndsAt(rules, now);
  const secondsLeft = endsAt - now;
  return {
    day: day + 1,
    endsAt,
    secondsLeft,
    tomorrowSeconds: rules.epochSeconds,
    shareLeft: secondsLeft / rules.epochSeconds,
    tone: secondsLeft <= LAST_HOUR_SECONDS ? "ember" : "calm",
  };
};

/** A season day's bounds in unix seconds, counted back from today's end; null before the season's first day. */
export const dayBounds = (rules: ExpeditionRules, now: number, day: number): { start: number; end: number } | null => {
  const today = seasonDay(rules, now);
  if (today === null || day < 1 || day > today + 1) return null;
  const end = expeditionDayEndsAt(rules, now) - (today + 1 - day) * rules.epochSeconds;
  return { start: end - rules.epochSeconds, end };
};

/**
 * The day that ended last: its number and its bounds in unix seconds, for the day-done card's totals. Null on the
 * season's first day, which follows no day.
 */
export const endedDay = (rules: ExpeditionRules, now: number): { day: number; start: number; end: number } | null => {
  const today = seasonDay(rules, now);
  const bounds = today ? dayBounds(rules, now, today) : null;
  return today && bounds ? { day: today, ...bounds } : null;
};
