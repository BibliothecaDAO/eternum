import { nativeRuleConstants as rule, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { TIER_WORDS } from "@bibliothecadao/types";

import { RELIC_KINDS, type RelicKind } from "../../../design-system/domain-icon-meaning";
import { PICK_EFFECT_WORDS, RELIC_WORDS } from "../../../design-system/kit/words";

import {
  damageDealtEffect,
  damageTakenEffect,
  percentFromTo,
  staminaRecoveryEffect,
  type PickEffectBase,
} from "../pick-effect-format";

export type ArmyRelic = { kind: RelicKind; rank: number };

const percentStep = (bps: number, rank: number) => (bps * rank) / 100;

const RELICS = {
  Blade: (rank) => damageDealtEffect(percentStep(rule.RELIC_BLADE_BPS, rank)),
  Ward: (rank) => damageTakenEffect(percentStep(rule.RELIC_WARD_BPS, rank)),
  Plunder: (rank) =>
    percentFromTo(PICK_EFFECT_WORDS.clearedSiteRewards, 100, 100 + percentStep(rule.RELIC_PLUNDER_BPS, rank)),
  StaminaRegen: (rank, base) =>
    staminaRecoveryEffect(base.staminaPerSecond, 10_000 + rule.STAMINA_REGEN_RELIC_STEP_PERCENT * rank * 100),
} satisfies Record<RelicKind, (rank: number, base: PickEffectBase) => string>;

const KIND_WORDS: Record<RelicKind, string> = RELIC_WORDS.kinds;

export const relicName = ({ kind, rank }: ArmyRelic): string => `${tierWord(rank)} ${KIND_WORDS[kind]}`;

export const relicEffect = ({ kind, rank }: ArmyRelic, base: PickEffectBase): string => RELICS[kind](rank, base);

export const relicSeconds = (
  { rank }: ArmyRelic,
  rules: Pick<NativeRows["SliceRules"], "relic_seconds_per_rank">,
): number => rules.relic_seconds_per_rank * rank;

/** The relic's id in ApplyRelic: its kind's index in the contract's order × 5 + its tier. */
export const relicId = ({ kind, rank }: ArmyRelic): number => RELIC_KINDS.indexOf(kind) * 5 + rank;

const tierWord = (rank: number): string => {
  const word = TIER_WORDS[rank - 1];
  if (!word) throw new Error(`A relic's tier is 1 to 5, not ${rank}`);
  return word;
};
