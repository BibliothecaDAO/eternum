import { ARMY_RELIC_KIND_NAMES, ResourcesIds } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeOathConstants, nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { holdsOath } from "./oaths";

export function armyRelicsEnabled(store: Pick<NativeFactStore, "get">, gameId: number): boolean | undefined {
  const rules = store.get("SliceRules", { game_id: gameId });
  return rules && rules.day_unit_seconds !== 0;
}

type ArmyKey = Pick<NativeRows["ExplorerTroops"], "game_id" | "explorer_id">;
type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

const RELIC_KIND_NAMES: Record<RelicKind, string> = ARMY_RELIC_KIND_NAMES;

export function armyRelicKindName(kind: string): string | undefined {
  return Object.hasOwn(RELIC_KIND_NAMES, kind) ? RELIC_KIND_NAMES[kind as RelicKind] : undefined;
}

const BONUS_PER_RANK = {
  Blade: nativeRuleConstants.RELIC_BLADE_BPS,
  Ward: nativeRuleConstants.RELIC_WARD_BPS,
  Plunder: nativeRuleConstants.RELIC_PLUNDER_BPS,
  StaminaRegen: nativeRuleConstants.STAMINA_REGEN_RELIC_STEP_PERCENT * 100,
  Antidote: nativeRuleConstants.RELIC_ANTIDOTE_BPS,
} satisfies Record<RelicKind, number>;

const SLOT_FIELDS = {
  Blade: "blade",
  Ward: "ward",
  Plunder: "plunder",
  StaminaRegen: "stamina_regen",
  Antidote: "antidote",
} as const satisfies Record<RelicKind, keyof Omit<NativeRows["ArmyRelics"], "game_id" | "explorer_id">>;

export type ArmyRelicLoadout = Pick<
  NativeRows["ArmyRelics"],
  "blade" | "ward" | "plunder" | "stamina_regen" | "antidote"
>;

export type RelicCollectOutcome = "Collected" | "Replaced" | "Merged" | "Discarded";

export function armyRelicRank(loadout: ArmyRelicLoadout | null | undefined, kind: RelicKind): number {
  return loadout ? loadout[SLOT_FIELDS[kind]] : 0;
}

export function collectArmyRelic(
  loadout: ArmyRelicLoadout | null | undefined,
  found: { kind: RelicKind; rank: number },
): {
  loadout: ArmyRelicLoadout;
  previousRank: number;
  resultRank: number;
  outcome: RelicCollectOutcome;
} {
  const current: ArmyRelicLoadout = loadout ?? {
    blade: 0,
    ward: 0,
    plunder: 0,
    stamina_regen: 0,
    antidote: 0,
  };
  const field = SLOT_FIELDS[found.kind];
  const previousRank = current[field];
  if (previousRank === 0) {
    return {
      loadout: { ...current, [field]: found.rank },
      previousRank,
      resultRank: found.rank,
      outcome: "Collected",
    };
  }
  if (previousRank === found.rank && previousRank < nativeRuleConstants.ATTRIBUTE_CAP) {
    const resultRank = previousRank + 1;
    return {
      loadout: { ...current, [field]: resultRank },
      previousRank,
      resultRank,
      outcome: "Merged",
    };
  }
  if (found.rank > previousRank) {
    return {
      loadout: { ...current, [field]: found.rank },
      previousRank,
      resultRank: found.rank,
      outcome: "Replaced",
    };
  }
  return { loadout: current, previousRank, resultRank: previousRank, outcome: "Discarded" };
}

export function deepLossForArmy(oaths: number, baseLoss: bigint, antidoteRank: number): bigint {
  const vitriolBps = holdsOath(oaths, nativeOathConstants.VITRIOL)
    ? nativeOathConstants.VITRIOL_REDUCTION_PERCENT * 100
    : 0;
  const antidoteBps = antidoteRank > 0 ? BONUS_PER_RANK.Antidote * antidoteRank : 0;
  const reductionBps = Math.min(vitriolBps + antidoteBps, 10_000);
  return (baseLoss * BigInt(10_000 - reductionBps)) / 10_000n;
}

/** A missing effect is zero only once the army's snapshot proves its absence. */
export function armyRelicBonus(
  store: Pick<NativeFactStore, "requireOrAbsent">,
  army: ArmyKey,
  kind: RelicKind,
  timestamp: number,
): number | undefined {
  const result = store.requireOrAbsent("ArmyRelicEffect", {
    game_id: army.game_id,
    explorer_id: army.explorer_id,
    kind,
  });
  if (!result.known) return undefined;
  const effect = result.known;
  if (effect.rank === 0 || effect.expires_at === 0n) return 0;
  return BigInt(Math.floor(timestamp)) < effect.expires_at ? BONUS_PER_RANK[kind] * effect.rank : 0;
}

export function staminaRegenBoost(
  store: Pick<NativeFactStore, "get" | "subscriptionScope" | "requireOrAbsent">,
  army: ArmyKey,
  settledAt: number,
): { incr_stamina_regen_percent_num: number; incr_stamina_regen_seconds_left: number } | undefined {
  const none = { incr_stamina_regen_percent_num: 0, incr_stamina_regen_seconds_left: 0 };
  const enabled = armyRelicsEnabled(store, army.game_id);
  if (enabled === undefined) return undefined;
  if (!enabled) return none;
  const result = store.requireOrAbsent("ArmyRelicEffect", {
    game_id: army.game_id,
    explorer_id: army.explorer_id,
    kind: "StaminaRegen",
  });
  if (!result.known) return undefined;
  const effect = result.known;
  if (effect.rank === 0 || Number(effect.expires_at) <= settledAt) return none;
  return {
    incr_stamina_regen_percent_num: BONUS_PER_RANK.StaminaRegen * effect.rank,
    incr_stamina_regen_seconds_left: Number(effect.expires_at) - settledAt,
  };
}

/** Plunder multiplies only labor and Essence, before the home's capacity clips the payout. */
export function armyRelicReward(
  store: Pick<NativeFactStore, "requireOrAbsent">,
  army: ArmyKey,
  reward: { resourceType: ResourcesIds; amount: bigint },
  timestamp: number,
): typeof reward | undefined {
  if (reward.resourceType !== ResourcesIds.Labor && reward.resourceType !== ResourcesIds.Essence) return reward;
  const bonus = armyRelicBonus(store, army, "Plunder", timestamp);
  return bonus === undefined ? undefined : { ...reward, amount: (reward.amount * BigInt(10_000 + bonus)) / 10_000n };
}
