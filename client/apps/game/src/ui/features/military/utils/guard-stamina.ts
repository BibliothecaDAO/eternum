import { StaminaManager } from "@bibliothecadao/eternum";
import { Troops, TroopTier, TroopType } from "@bibliothecadao/types";

interface GuardTroopsLike {
  category?: unknown;
  tier?: unknown;
  stamina?: {
    amount?: unknown;
    updated_tick?: unknown;
  } | null;
  boosts?: {
    incr_stamina_regen_percent_num?: unknown;
    incr_stamina_regen_tick_count?: unknown;
  } | null;
}

const toGuardTroopsLike = (troops: unknown): GuardTroopsLike => {
  if (typeof troops !== "object" || troops === null) {
    return {};
  }
  return troops as GuardTroopsLike;
};

const hasStaminaBoostData = (troops: GuardTroopsLike): boolean => {
  if (!troops?.stamina || !troops?.boosts) return false;

  return (
    troops.boosts.incr_stamina_regen_percent_num !== undefined &&
    troops.boosts.incr_stamina_regen_tick_count !== undefined
  );
};

export const getGuardStaminaSnapshot = (
  troops: unknown,
  currentArmiesTick: number,
): { current: number; max: number } | null => {
  const data = toGuardTroopsLike(troops);
  const category = data.category as TroopType | undefined | null;
  const tier = data.tier as TroopTier | undefined | null;

  if (category === undefined || category === null || tier === undefined || tier === null) {
    return null;
  }

  let max = 0;
  try {
    max = StaminaManager.getMaxStamina(category, tier);
  } catch {
    return null;
  }

  const baseAmount = data.stamina?.amount;
  const baseCurrent = Number(baseAmount ?? 0n);

  if (hasStaminaBoostData(data)) {
    return {
      current: Number(StaminaManager.getStamina(data as unknown as Troops, currentArmiesTick).amount),
      max,
    };
  }

  return { current: baseCurrent, max };
};
