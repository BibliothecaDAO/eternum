import { nativeRuleConstants as rule, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { TIER_WORDS } from "@bibliothecadao/types";

import type { IconMeaning } from "@/ui/design-system/icon";
import { PICK_EFFECT_WORDS, RELIC_WORDS } from "@/ui/design-system/kit/words";

import { nativeFactModels } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import {
  damageDealtEffect,
  damageTakenEffect,
  percentFromTo,
  staminaRecoveryEffect,
  type PickEffectBase,
} from "../pick-effect-text";

/** An army relic's kind, as the native facts name it. */
export type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

/** A relic an army carries: its kind and its tier, 1 (Common) to 5 (Legendary). */
export type ArmyRelic = { kind: RelicKind; rank: number };

/** The kinds in the contract's order (army_relics.cairo): a relic's id is that order's index × 5 + its tier. */
export const RELIC_KINDS = nativeFactModels.ArmyRelicEffect.fields.kind.enum as readonly RelicKind[];

const percentStep = (bps: number, rank: number) => (bps * rank) / 100;

/**
 * Each kind's painting, name and what one relic of a tier does, from the contract's rule constants: one step a tier
 * (docs/plans/frontier-season-1.md, relics).
 */
const RELICS = {
  Blade: {
    icon: "damage-relic-2",
    effect: (rank) => damageDealtEffect(percentStep(rule.RELIC_BLADE_BPS, rank)),
  },
  Ward: {
    icon: "damage-reduction-relic-2",
    effect: (rank) => damageTakenEffect(percentStep(rule.RELIC_WARD_BPS, rank)),
  },
  Plunder: {
    icon: "exploration-reward-relic-2",
    effect: (rank) =>
      percentFromTo(PICK_EFFECT_WORDS.clearedSiteRewards, 100, 100 + percentStep(rule.RELIC_PLUNDER_BPS, rank)),
  },
  StaminaRegen: {
    icon: "stamina-relic-2",
    effect: (rank, base) =>
      staminaRecoveryEffect(base.staminaPerSecond, 10_000 + rule.STAMINA_REGEN_RELIC_STEP_PERCENT * rank * 100),
  },
} satisfies Record<RelicKind, { icon: IconMeaning; effect: (rank: number, base: PickEffectBase) => string }>;

/** Each kind's word, held to every kind the contract has. */
const KIND_WORDS: Record<RelicKind, string> = RELIC_WORDS.kinds;

/** A relic by its tier and kind, as a player reads it: "Rare Blade". */
export const relicName = ({ kind, rank }: ArmyRelic): string => `${tierWord(rank)} ${KIND_WORDS[kind]}`;

export const relicEffect = ({ kind, rank }: ArmyRelic, base: PickEffectBase): string => RELICS[kind].effect(rank, base);

export const relicIcon = (kind: RelicKind): IconMeaning => RELICS[kind].icon;

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
