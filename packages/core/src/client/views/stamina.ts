import type { StaminaEffects } from "@bibliothecadao/types";
import { nativeBaneConstants, nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { dayAtIndex } from "../../utils/days";
import { readExpeditionRules } from "../../utils/expeditions";
import { BANE_MODELS, readBaneEffects } from "./banes";
import { readTriumphPeriod, TRIUMPH_MODELS } from "./triumphs";
import { readOptionalSeasonRow } from "./season-rows";
import { oathRegenBonusPerHour } from "../../utils/oaths";

export const STAMINA_MODELS = [
  ...BANE_MODELS,
  "Structure",
  ...TRIUMPH_MODELS,
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
  "ArmyDay",
  "ArmySlot",
  "ArmyProgress",
  "ExplorerTroops",
  "TileOccupancy",
  "DeepArmy",
  "DeepRules",
] as const;

/** Regeneration forecasts end with the army's day; an unrecorded later roll is never predicted. */
export function readStaminaEffects(
  store: NativeFactStore,
  gameId: number,
  home: number | bigint,
  epoch: bigint,
  from: number,
  depth: number,
  oaths: number,
): NativeFactResult<StaminaEffects> {
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) return { known: { until: Infinity, windows: [] } };
  const day = dayAtIndex(calendar, Number(epoch));
  const until = day.end;
  const bonusPerHour = oathRegenBonusPerHour(oaths);
  const bonus = bonusPerHour > 0 ? { bonusPerHour } : {};
  if (depth === 3) return { known: { until, windows: [], ...bonus } };
  const bane = readBaneEffects(store, gameId, home, from, until);
  if (!bane.known) return bane;
  const race = readOptionalSeasonRow(store, "RaceRules", { game_id: gameId });
  if (!race.known) return race;
  const { windows, staminaPercent } = bane.known;
  const periods: { start: number; end: number; rateBps: number }[] = windows
    .filter((window) => window.kinds.includes(nativeBaneConstants.MIST_TIDE))
    .map((window) => ({ start: window.start, end: window.end, rateBps: staminaPercent * 100 }));
  if (race.known.row) {
    const wind = readTriumphPeriod(store, gameId, home, nativeRaceConstants.SECOND_WIND_STAGE, calendar);
    if (!wind.known) return wind;
    if (wind.known.period) {
      periods.push({ ...wind.known.period, rateBps: race.known.row.second_wind_percent * 100 });
    }
  }
  return { known: { until, windows: combinePeriods(periods, from, until), ...bonus } };
}

/** The intersection multiplies the rates while each boundary retains the same fractional remainder. */
function combinePeriods(periods: StaminaEffects["windows"], from: number, until: number): StaminaEffects["windows"] {
  const boundaries = [...new Set([from, until, ...periods.flatMap((period) => [period.start, period.end])])]
    .filter((second) => second >= from && second <= until)
    .sort((a, b) => a - b);
  return boundaries.slice(0, -1).flatMap((start, index) => {
    const rateBps = periods
      .filter((period) => period.start <= start && start < period.end)
      .reduce((rate, period) => Math.floor((rate * period.rateBps) / 10_000), 10_000);
    return rateBps === 10_000 ? [] : [{ start, end: boundaries[index + 1]!, rateBps }];
  });
}
