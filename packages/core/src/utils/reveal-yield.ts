import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { tierStrength } from "./tier-strength";

type TroopLimitConfig = NativeRows["SliceRules"]["troop_limit_config"];

/**
 * What one new reveal sends home in Frontier, Essence or labor at even odds, in scaled resource units exactly as the
 * contract pays it: the scaled troop count times the tier's strength times the depth's reveal percent
 * (DepthRules.supply_multiplier: 10 / 15 / 20 / 25), with one truncating division at the end. Attributes and relics
 * never change it.
 */
export const revealYield = (
  troops: Pick<NativeRows["ExplorerTroops"]["troops"], "tier" | "count">,
  limits: TroopLimitConfig,
  revealPercent: number,
): bigint => (troops.count * BigInt(tierStrength(troops.tier, limits)) * BigInt(revealPercent)) / 100n;

/** The reveal percent of a depth, from the game's depth rules; undefined where the game has no such depth. */
export const readRevealPercent = (
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  depth: number,
): number | undefined => store.get("DepthRules", { game_id: gameId, depth })?.supply_multiplier;
