import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

type TroopLimitConfig = NativeRows["SliceRules"]["troop_limit_config"];

/** A tier's strength per troop, the one reading of the game's troop limits (Frontier 1 / 3 / 9). */
export const tierStrength = (
  tier: NativeRows["ExplorerTroops"]["troops"]["tier"],
  limits: TroopLimitConfig,
): number => {
  if (tier === "T1") return limits.t1_tier_strength;
  if (tier === "T2") return limits.t2_tier_strength;
  if (tier === "T3") return limits.t3_tier_strength;
  throw new Error(`Unknown troop tier ${tier}`);
};
