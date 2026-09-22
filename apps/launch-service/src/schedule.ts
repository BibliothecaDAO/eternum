import { frontierSeasonRequest } from "./schemas";
import type { SlotStore } from "./slots";
import type { LaunchServiceStore } from "./store";

/** Scheduling is a no-op once the season's run exists, whatever its status, so restarts never create a second game. */
export const scheduleFrontierSeason = (store: LaunchServiceStore, seasonStart: string) =>
  store.enqueue("game", frontierSeasonRequest(seasonStart));

/** Free Blitz slots close at these UTC hours every day; registration is open from the previous close. */
const BLITZ_SLOT_HOURS_UTC = [11, 20] as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const pad = (value: number) => String(value).padStart(2, "0");

/** The next slot is the first timetable hour after `now`; its name is that instant, so every worker names the same slot. */
export const nextBlitzSlot = (now: Date): { name: string; closesAt: string } => {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const closings = [0, DAY_MS].flatMap((day) => BLITZ_SLOT_HOURS_UTC.map((hour) => midnight + day + hour * HOUR_MS));
  const closesAt = new Date(closings.find((closing) => closing > now.getTime())!);
  const day = `${closesAt.getUTCFullYear()}${pad(closesAt.getUTCMonth() + 1)}${pad(closesAt.getUTCDate())}`;
  return { name: `blitz-${day}-${pad(closesAt.getUTCHours())}00`, closesAt: closesAt.toISOString() };
};

/** Creates the next slot once per process; the store's insert is idempotent, so concurrent workers still make one. */
export const createBlitzTimetable = (slots: SlotStore) => {
  let ensured: string | undefined;
  return async (now = new Date()): Promise<void> => {
    const slot = nextBlitzSlot(now);
    if (slot.name === ensured) return;
    await slots.create(slot.name, slot.closesAt);
    ensured = slot.name;
  };
};
