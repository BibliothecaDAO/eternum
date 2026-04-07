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

const hasTrackedStamina = (troops: GuardTroopsLike): boolean => {
  return troops?.stamina?.updated_tick !== undefined && troops.stamina.updated_tick !== null;
};

const toBigIntOrZero = (value: unknown): bigint => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }

  return 0n;
};

const toNumberOrZero = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const buildGuardTroopsForStaminaComputation = (
  troops: GuardTroopsLike,
  category: TroopType,
  tier: TroopTier,
): Troops => {
  return {
    category,
    tier,
    count: 0n,
    stamina: {
      amount: toBigIntOrZero(troops.stamina?.amount),
      updated_tick: toBigIntOrZero(troops.stamina?.updated_tick),
    },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_tick: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_tick: 0,
      incr_stamina_regen_percent_num: toNumberOrZero(troops.boosts?.incr_stamina_regen_percent_num),
      incr_stamina_regen_tick_count: toNumberOrZero(troops.boosts?.incr_stamina_regen_tick_count),
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_tick: 0,
    },
    battle_cooldown_end: 0,
  };
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

  if (hasTrackedStamina(data)) {
    return {
      current: Number(
        StaminaManager.getStamina(
          buildGuardTroopsForStaminaComputation(data, category as TroopType, tier as TroopTier),
          currentArmiesTick,
        ).amount,
      ),
      max,
    };
  }

  return { current: baseCurrent, max };
};
