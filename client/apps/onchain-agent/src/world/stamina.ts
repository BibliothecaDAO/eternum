/**
 * Stamina projection — mirrors the on-chain Stamina::refill logic.
 *
 * Does not account for boosts (TroopBoosts) — the agent doesn't
 * have access to boost data. This is a conservative underestimate.
 */

import type { StaminaConfig } from "@bibliothecadao/torii";

const TIER_BONUS: Record<string, number> = {
  T1: 0,
  T2: 20,
  T3: 40,
};

/**
 * Get the maximum stamina for a troop given its type, tier, and config base value.
 * On-chain: base max (from config) + tier bonus (+20 for T2, +40 for T3).
 *
 * @param troopType - Troop type string ("Knight", "Crossbowman", or "Paladin"). Not used by this function; the bonus is tier-based only.
 * @param troopTier - Troop tier string: "T1", "T2", or "T3".
 * @param baseMax - Base maximum stamina value sourced from the on-chain stamina config.
 * @returns The effective maximum stamina after applying the tier bonus.
 */
export function getMaxStamina(troopType: string, troopTier: string, baseMax: number): number {
  return baseMax + (TIER_BONUS[troopTier] ?? 0);
}

/**
 * Arguments for projecting stamina forward from the last on-chain snapshot.
 */
interface ProjectStaminaArgs {
  /** Stamina amount recorded at the last on-chain update. */
  currentAmount: number;
  /** Game tick at which the on-chain stamina was last written. */
  updatedTick: number;
  /** Current game tick derived from the current wall-clock time. */
  currentTick: number;
  /** Stamina gained per elapsed tick (from the on-chain stamina config). */
  gainPerTick: number;
  /** Maximum stamina the troop can hold; regeneration is capped at this value. */
  maxStamina: number;
}

/**
 * Project stamina forward from the last on-chain update tick to the current tick.
 * Returns the current on-chain amount unchanged if the tick has not advanced or gain is zero.
 *
 * @param args - Stamina projection arguments (see {@link ProjectStaminaArgs}).
 * @returns Projected stamina value capped at `maxStamina`.
 */
export function projectStamina(args: ProjectStaminaArgs): number {
  const { currentAmount, updatedTick, currentTick, gainPerTick, maxStamina } = args;

  if (currentTick <= updatedTick || gainPerTick <= 0) {
    return currentAmount;
  }

  const elapsedTicks = currentTick - updatedTick;
  const gain = elapsedTicks * gainPerTick;
  return Math.min(currentAmount + gain, maxStamina);
}

/**
 * Resolve the base max stamina from config for a given troop type.
 */
function baseMaxFromConfig(troopType: string, config: StaminaConfig): number {
  switch (troopType) {
    case "Knight":
      return config.knightMaxStamina;
    case "Paladin":
      return config.paladinMaxStamina;
    case "Crossbowman":
      return config.crossbowmanMaxStamina;
    default:
      return config.knightMaxStamina;
  }
}

/**
 * Compute the projected stamina for an explorer at the current wall-clock time.
 * Convenience wrapper around {@link projectStamina} that derives the current tick
 * and max stamina from the on-chain stamina config automatically.
 *
 * @param explorer - Explorer snapshot containing current stamina, last updated tick, troop type, and tier.
 * @param staminaConfig - On-chain stamina configuration (tick interval, gain rate, per-type max values).
 * @param nowSeconds - Current UNIX timestamp in seconds. Defaults to `Date.now() / 1000`.
 * @returns Projected stamina value capped at the explorer's effective maximum.
 */
export function projectExplorerStamina(
  explorer: { stamina: number; staminaUpdatedTick: number; troopType: string; troopTier: string },
  staminaConfig: StaminaConfig,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): number {
  const armiesTickInterval = staminaConfig.armiesTickInSeconds || 1;
  const currentTick = Math.floor(nowSeconds / armiesTickInterval);
  const baseMax = baseMaxFromConfig(explorer.troopType, staminaConfig);
  const maxStamina = getMaxStamina(explorer.troopType, explorer.troopTier, baseMax);

  return projectStamina({
    currentAmount: explorer.stamina,
    updatedTick: explorer.staminaUpdatedTick,
    currentTick,
    gainPerTick: staminaConfig.gainPerTick,
    maxStamina,
  });
}
