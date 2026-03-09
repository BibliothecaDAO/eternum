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
 * Get max stamina for a troop type and tier.
 * On-chain: base max (from config) + tier bonus (+20 for T2, +40 for T3).
 */
export function getMaxStamina(troopType: string, troopTier: string, baseMax: number): number {
  return baseMax + (TIER_BONUS[troopTier] ?? 0);
}

interface ProjectStaminaArgs {
  currentAmount: number;
  updatedTick: number;
  currentTick: number;
  gainPerTick: number;
  maxStamina: number;
}

/**
 * Project stamina forward from last on-chain update to the current tick.
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
 * Compute projected stamina for an explorer given the current wall clock time
 * and game stamina config. Convenience wrapper around projectStamina.
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
