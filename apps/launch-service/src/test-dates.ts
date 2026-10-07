import { frontierPreset } from "../../../config/source/frontier/native";
import { seasonSeconds } from "../../../packages/core/src/utils/days";

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

/** A Frontier season's end: its start plus the preset's bags of days, ten weeks. */
export const frontierSeasonEnd = (startsAt: Date | string) =>
  new Date(
    new Date(startsAt).getTime() + seasonSeconds(frontierPreset.seasonBags, frontierPreset.dayUnitSeconds) * 1_000,
  ).toISOString();

/** The name the timetable gives the Blitz slot closing at this instant. */
export const blitzSlotName = (closesAt: Date) => {
  const iso = closesAt.toISOString();
  return `blitz-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 13)}00`;
};
