import { nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { TriumphStage } from "../../sync/herald-http-types";
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
} as const satisfies Record<TriumphStage, string>;

export type { TriumphStage };

export function triumphPercentsOf(
  rules: Record<(typeof TRIUMPH_PERCENT)[TriumphStage], number>,
): Record<TriumphStage, number> {
  return Object.fromEntries(
    (Object.keys(TRIUMPH_PERCENT).map(Number) as TriumphStage[]).map((stage) => [stage, rules[TRIUMPH_PERCENT[stage]]]),
  ) as Record<TriumphStage, number>;
}
