import { ResourcesIds } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export function armyRelicsEnabled(store: Pick<NativeFactStore, "get">, gameId: number): boolean | undefined {
  const rules = store.get("SliceRules", { game_id: gameId });
  return rules && rules.day_unit_seconds !== 0;
}

type ArmyKey = Pick<NativeRows["ExplorerTroops"], "game_id" | "explorer_id">;
type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

const BONUS_PER_RANK = {
  Blade: nativeRuleConstants.RELIC_BLADE_BPS,
  Ward: nativeRuleConstants.RELIC_WARD_BPS,
  Plunder: nativeRuleConstants.RELIC_PLUNDER_BPS,
  StaminaRegen: nativeRuleConstants.STAMINA_REGEN_RELIC_STEP_PERCENT * 100,
} satisfies Record<RelicKind, number>;

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
