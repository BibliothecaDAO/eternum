import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import {
  nativeRuleConstants as rule,
  type NativeRows,
} from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { readExpeditionRules, seasonDay } from "../../utils/expeditions";

/** The race's four Triumphs, by the stage whose completion earns each (rules.cairo); the fifth stage ends the season. */
const TRIUMPH_STAGES = [
  rule.CLEAR_MIST_STAGE,
  rule.SECOND_WIND_STAGE,
  rule.PALE_MOON_STAGE,
  rule.SPOILS_STAGE,
] as const;
export type TriumphStage = (typeof TRIUMPH_STAGES)[number];

/** A Triumph on its day: its stage, and the percentage it applies above the Deep (RaceRules'). */
export interface TriumphToday {
  stage: TriumphStage;
  percent: number;
}

/**
 * A home's Glory, in points: what its armies earned holding the Foundation or the Altar (RaceMember, in resource
 * precision so a tick's 5 splits by troops). A home that never held a site has none, once the store knows its row is
 * absent; unknown, with the reason, while it cannot tell. None in a game without the race.
 */
export function readHomeGlory(
  store: NativeFactStore,
  game_id: number,
  home: number,
): NativeFactResult<number> | undefined {
  if (!store.get("RaceRules", { game_id })) return undefined;
  const member = store.requireOrAbsent("RaceMember", { game_id, entity_id: home });
  return member.known ? { known: Number(member.known.glory) / RESOURCE_PRECISION } : { unknown: member.unknown };
}

/**
 * The Triumph the home's Aspect has today, as triumphs.cairo applies it: the stage whose TriumphDay is today's index.
 * Known null when no stage's day is today; unknown, with the reason, while the home's Aspect or a stage's row is not
 * known present or absent. None in a game without the race, or outside the season's days.
 */
export function readTodaysTriumph(
  store: NativeFactStore,
  game_id: number,
  home: number,
  timestamp: number,
): NativeFactResult<TriumphToday | null> | undefined {
  const rules = store.get("RaceRules", { game_id });
  const calendar = readExpeditionRules(store, game_id);
  const today = calendar && seasonDay(calendar, timestamp);
  if (!rules || today === null || today === undefined) return undefined;
  const aspect = store.get("HomeAspect", { game_id, home });
  if (!aspect) return { unknown: `HomeAspect ${home} is not known` };
  for (const stage of TRIUMPH_STAGES) {
    const key = { game_id, aspect: aspect.aspect, stage };
    const earned = store.get("TriumphDay", key);
    if (earned && Number(earned.day) === today) return { known: { stage, percent: triumphPercent(rules, stage) } };
    if (earned) continue;
    const absent = store.absenceKnown("TriumphDay", key);
    if (!absent.known) return { unknown: absent.unknown };
  }
  return { known: null };
}

/** Each Triumph's percentage, as RaceRules holds it. */
const triumphPercent = (rules: NativeRows["RaceRules"], stage: TriumphStage): number =>
  ({
    [rule.CLEAR_MIST_STAGE]: rules.clear_mist_percent,
    [rule.SECOND_WIND_STAGE]: rules.second_wind_percent,
    [rule.PALE_MOON_STAGE]: rules.pale_moon_percent,
    [rule.SPOILS_STAGE]: rules.spoils_percent,
  })[stage];
