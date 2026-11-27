import { deepLossForArmy } from "@bibliothecadao/eternum";
import { nativeRuleConstants as rule, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, formatPercent, TIER_WORDS } from "@bibliothecadao/types";

import { type RelicKind } from "../../../design-system/domain-icon-meaning";
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
  Antidote: (rank, base) => {
    const reduction = percentStep(rule.RELIC_ANTIDOTE_BPS, rank);
    if (base.deepLossPerTick === undefined) {
      return percentFromTo(PICK_EFFECT_WORDS.deepPoisonTitle, 100, 100 - reduction, PICK_EFFECT_WORDS.less);
    }
    const rawBase = base.deepBaseLossPerTick ?? base.deepLossPerTick;
    const next = Number(deepLossForArmy(base.oaths ?? 0, BigInt(Math.round(rawBase)), rank));
    return `${PICK_EFFECT_WORDS.deepPoisonTitle}: ${formatExact(base.deepLossPerTick)} → ${formatExact(next)} (${PICK_EFFECT_WORDS.less})`;
  },
} satisfies Record<RelicKind, (rank: number, base: PickEffectBase) => string>;

const COMPACT_STATS = {
  Blade: (rank) =>
    `${formatPercent(percentStep(rule.RELIC_BLADE_BPS, rank) / 100, { signed: true })} ${PICK_EFFECT_WORDS.battleDamageDealt}`,
  Ward: (rank) =>
    `${formatPercent(-percentStep(rule.RELIC_WARD_BPS, rank) / 100, { signed: true })} ${PICK_EFFECT_WORDS.battleDamageTaken}`,
  Plunder: (rank) =>
    `${formatPercent(percentStep(rule.RELIC_PLUNDER_BPS, rank) / 100, { signed: true })} ${PICK_EFFECT_WORDS.siteRewards}`,
  StaminaRegen: (rank) =>
    `${formatPercent((rule.STAMINA_REGEN_RELIC_STEP_PERCENT * rank) / 100, { signed: true })} ${PICK_EFFECT_WORDS.oathStaminaRecovery}`,
  Antidote: (rank) =>
    `${formatPercent(-percentStep(rule.RELIC_ANTIDOTE_BPS, rank) / 100, { signed: true })} ${PICK_EFFECT_WORDS.deepPoison}`,
} satisfies Record<RelicKind, (rank: number) => string>;

const KIND_WORDS: Record<RelicKind, string> = RELIC_WORDS.kinds;

export const relicName = ({ kind, rank }: ArmyRelic): string => `${tierWord(rank)} ${KIND_WORDS[kind]}`;

export const relicEffect = ({ kind, rank }: ArmyRelic, base: PickEffectBase): string => RELICS[kind](rank, base);

export const relicCompactStat = ({ kind, rank }: ArmyRelic): string => COMPACT_STATS[kind](rank);

export const relicSeconds = (
  { rank }: ArmyRelic,
  rules: Pick<NativeRows["SliceRules"], "relic_seconds_per_rank">,
): number => rules.relic_seconds_per_rank * rank;

const tierWord = (rank: number): string => {
  const word = TIER_WORDS[rank - 1];
  if (!word) throw new Error(`A relic's tier is 1 to 5, not ${rank}`);
  return word;
};
