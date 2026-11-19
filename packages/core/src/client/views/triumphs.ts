import { nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import type { ExpeditionRules } from "../../utils/expeditions";
import { dayAtIndex } from "../../utils/days";
import { readOptionalSeasonRow } from "./season-rows";

export const TRIUMPH_MODELS = ["RaceRules", "HomeAspect", "TriumphDay"] as const;

/** Recorded days use the planned calendar; a race finish clips their effect, never shifts it. */
export function readTriumphPeriod(
  store: NativeFactStore,
  gameId: number,
  home: number | bigint,
  stage: number,
  calendar: ExpeditionRules,
): NativeFactResult<{ period: { start: number; end: number } | null }> {
  const membership = store.get("HomeAspect", { game_id: gameId, home });
  if (!membership) return { unknown: "MISSING_HOME_ASPECT" };
  const triumph = readOptionalSeasonRow(store, "TriumphDay", { game_id: gameId, aspect: membership.aspect, stage });
  if (!triumph.known) return triumph;
  if (!triumph.known.row) return { known: { period: null } };
  const day = dayAtIndex({ ...calendar, endAt: calendar.scheduledEndAt }, Number(triumph.known.row.day));
  const end = Math.min(day.end, calendar.endAt);
  return { known: { period: day.start < end ? { start: day.start, end } : null } };
}

const TRIUMPH_PERCENT = {
  [nativeRaceConstants.CLEAR_MIST_STAGE]: "clear_mist_percent",
  [nativeRaceConstants.SECOND_WIND_STAGE]: "second_wind_percent",
  [nativeRaceConstants.PALE_MOON_STAGE]: "pale_moon_percent",
  [nativeRaceConstants.SPOILS_STAGE]: "spoils_percent",
} as const;

/** The Triumph in force for the home at `now`, with the percent its rule row sets; null on a day with none. */
export function readActiveTriumph(
  store: NativeFactStore,
  gameId: number,
  home: number | bigint,
  now: number,
  calendar: ExpeditionRules,
): NativeFactResult<{ active: { stage: keyof typeof TRIUMPH_PERCENT; percent: number } | null }> {
  const rules = readOptionalSeasonRow(store, "RaceRules", { game_id: gameId });
  if (!rules.known) return rules;
  if (!rules.known.row) return { known: { active: null } };
  for (const stage of Object.keys(TRIUMPH_PERCENT).map(Number) as (keyof typeof TRIUMPH_PERCENT)[]) {
    const triumph = readTriumphPeriod(store, gameId, home, stage, calendar);
    if (!triumph.known) return triumph;
    const { period } = triumph.known;
    if (period && now >= period.start && now < period.end)
      return { known: { active: { stage, percent: rules.known.row[TRIUMPH_PERCENT[stage]] } } };
  }
  return { known: { active: null } };
}
