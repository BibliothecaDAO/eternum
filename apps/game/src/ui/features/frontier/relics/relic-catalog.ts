import { nativeRuleConstants as rule, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { TIER_WORDS } from "@bibliothecadao/types";

import type { IconMeaning } from "@/ui/design-system/icon";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

import { nativeFactModels } from "../../../../../../../contracts/l3/world-native/schema/client.gen";

/** An army relic's kind, as the native facts name it. */
export type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

/** A relic an army carries: its kind and its tier, 1 (Common) to 5 (Legendary). */
export type ArmyRelic = { kind: RelicKind; rank: number };

/** The kinds in the contract's order (army_relics.cairo): a relic's id is that order's index × 5 + its tier. */
export const RELIC_KINDS = nativeFactModels.ArmyRelicEffect.fields.kind.enum as readonly RelicKind[];

const percent = (bps: number, rank: number) => `${(bps * rank) / 100}%`;

/**
 * Each kind's painting, name and what one relic of a tier does, from the contract's rule constants: one step a tier
 * (docs/plans/frontier-season-1.md, relics). The Tome is new; it wears the book.
 */
const RELICS = {
  Blade: { icon: "damage-relic-2", effect: (rank) => RELIC_WORDS.blade(percent(rule.RELIC_BLADE_BPS, rank)) },
  Ward: { icon: "damage-reduction-relic-2", effect: (rank) => RELIC_WORDS.ward(percent(rule.RELIC_WARD_BPS, rank)) },
  Plunder: {
    icon: "exploration-reward-relic-2",
    effect: (rank) => RELIC_WORDS.plunder(percent(rule.RELIC_PLUNDER_BPS, rank)),
  },
  FarEye: { icon: "exploration-relic-2", effect: (rank) => RELIC_WORDS.farEye(rule.RELIC_TILES_PER_RANK * rank) },
  Tome: { icon: "book", effect: (rank) => RELIC_WORDS.tome(percent(rule.RELIC_TOME_BPS, rank)) },
} satisfies Record<RelicKind, { icon: IconMeaning; effect: (rank: number) => string }>;

/** Each kind's word, held to every kind the contract has. */
const KIND_WORDS: Record<RelicKind, string> = RELIC_WORDS.kinds;

/** A relic by its tier and kind, as a player reads it: "Rare Blade". */
export const relicName = ({ kind, rank }: ArmyRelic): string => `${tierWord(rank)} ${KIND_WORDS[kind]}`;

/** What a relic does once switched on: "+30% damage dealt". */
export const relicEffect = ({ kind, rank }: ArmyRelic): string => RELICS[kind].effect(rank);

export const relicIcon = (kind: RelicKind): IconMeaning => RELICS[kind].icon;

/** How long a switched-on relic works: 30 minutes a tier. The Far-Eye reveals at once and has no duration. */
export const relicSeconds = ({ kind, rank }: ArmyRelic): number | null =>
  kind === "FarEye" ? null : rule.RELIC_SECONDS_PER_RANK * rank;

/** The relic's id in ApplyRelic: its kind's index in the contract's order × 5 + its tier. */
export const relicId = ({ kind, rank }: ArmyRelic): number => RELIC_KINDS.indexOf(kind) * 5 + rank;

const tierWord = (rank: number): string => {
  const word = TIER_WORDS[rank - 1];
  if (!word) throw new Error(`A relic's tier is 1 to 5, not ${rank}`);
  return word;
};
