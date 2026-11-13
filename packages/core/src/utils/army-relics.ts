import { ResourcesIds } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";

/**
 * Whether a game's ruins pay army relics, for current and historical releases: a day game whose preset carries no
 * LORDS chest rules. Undefined while that cannot be told: the rules not held yet, or no ChestRules row before the
 * snapshot is complete, when its absence proves nothing.
 */
export function armyRelicsEnabled(
  store: Pick<NativeFactStore, "get" | "subscriptionScope">,
  gameId: number,
): boolean | undefined {
  const rules = store.get("SliceRules", { game_id: gameId });
  if (!rules) return undefined;
  if (rules.day_unit_seconds === 0) return false;
  if (store.get("ChestRules", { game_id: gameId })) return false;
  // A shared row lies in every scope: once the snapshot's scope is known, a missing one is absent.
  return store.subscriptionScope().known ? true : undefined;
}


type ArmyKey = Pick<NativeRows["ExplorerTroops"], "game_id" | "explorer_id">;
type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

const BONUS_PER_RANK = {
  Blade: nativeRuleConstants.RELIC_BLADE_BPS,
  Ward: nativeRuleConstants.RELIC_WARD_BPS,
  Plunder: nativeRuleConstants.RELIC_PLUNDER_BPS,
  FarEye: 0,
  Tome: nativeRuleConstants.RELIC_TOME_BPS,
} satisfies Record<RelicKind, number>;

/** A missing effect is zero only once the army's snapshot proves its absence. */
export function armyRelicBonus(
  store: Pick<NativeFactStore, "requireOrAbsent">,
  army: ArmyKey,
  kind: RelicKind,
  timestamp: number,
): number | undefined {
  const result = store.requireOrAbsent("ArmyRelicEffect", { game_id: army.game_id, explorer_id: army.explorer_id, kind });
  if (!result.known) return undefined;
  const effect = result.known;
  if (effect.rank === 0 || effect.expires_at === 0n) return 0;
  return BigInt(Math.floor(timestamp)) < effect.expires_at ? BONUS_PER_RANK[kind] * effect.rank : 0;
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

/** Tome follows the contract's integer rounding after the base XP calculation. */
export function armyRelicXp(
  store: Pick<NativeFactStore, "requireOrAbsent">,
  army: ArmyKey,
  amount: number,
  timestamp: number,
): number | undefined {
  const bonus = armyRelicBonus(store, army, "Tome", timestamp);
  return bonus === undefined ? undefined : Number((BigInt(amount) * BigInt(10_000 + bonus)) / 10_000n);
}
