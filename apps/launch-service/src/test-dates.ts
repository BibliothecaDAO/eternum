import { frontierSeasonOnePreset } from "../../../config/source/frontier/season-one";
import { DAYS_PER_BAG, seasonSeconds } from "../../../packages/core/src/utils/days";

const DAY_MS = 86_400_000;
// Two midnights ahead, not one: a run that crosses midnight UTC still finds every date in the future.
const firstDay = (Math.floor(Date.now() / DAY_MS) + 2) * DAY_MS;

/**
 * An instant on a calendar that starts at a midnight UTC at least a day ahead, so a test's dates are always in the
 * future of the real clock the slot store and the calendar routes read: `day(0)` is that midnight, `day(1, 11)` the
 * 11:00 after it.
 */
export const day = (days: number, hour = 0, minute = 0, second = 0) =>
  new Date(firstDay + days * DAY_MS + ((hour * 60 + minute) * 60 + second) * 1_000);

const SEASON_BAGS = frontierSeasonOnePreset.race.seasonDays / DAYS_PER_BAG;

export const frontierSeasonEnd = (startsAt: Date | string, bags = SEASON_BAGS) =>
  new Date(
    new Date(startsAt).getTime() + seasonSeconds(bags, frontierSeasonOnePreset.dayUnitSeconds) * 1_000,
  ).toISOString();
