import { StaminaManager } from "@bibliothecadao/eternum";
import { Troops, TroopTier, TroopType } from "@bibliothecadao/types";

interface GuardTroopsLike {
  category?: unknown;
  staminaMax?: number;
  tier?: unknown;
  stamina?: {
    amount?: unknown;
    settled_at?: unknown;
    remainder?: unknown;
  } | null;
  boosts?: {
    incr_stamina_regen_percent_num?: unknown;
    incr_stamina_regen_seconds_left?: unknown;
  } | null;
}

const toGuardTroopsLike = (troops: unknown): GuardTroopsLike => {
  if (typeof troops !== "object" || troops === null) {
    return {};
  }
  return troops as GuardTroopsLike;
};

const hasTrackedStamina = (troops: GuardTroopsLike): boolean => {
  return troops?.stamina?.settled_at !== undefined && troops.stamina.settled_at !== null;
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
    staminaMax: troops.staminaMax,
    stamina: {
      amount: toBigIntOrZero(troops.stamina?.amount),
      settled_at: toNumberOrZero(troops.stamina?.settled_at),
      remainder: toNumberOrZero(troops.stamina?.remainder),
    },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_at: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_at: 0,
      incr_stamina_regen_percent_num: toNumberOrZero(troops.boosts?.incr_stamina_regen_percent_num),
      incr_stamina_regen_seconds_left: toNumberOrZero(troops.boosts?.incr_stamina_regen_seconds_left),
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_at: 0,
    },
    battle_cooldown_end: 0,
  };
};

export const getGuardStaminaSnapshot = (
  troops: unknown,
  timestamp: number,
): { current: number; max: number } | null => {
  const data = toGuardTroopsLike(troops);
  const category = data.category as TroopType | undefined | null;
  const tier = data.tier as TroopTier | undefined | null;

  if (category === undefined || category === null || tier === undefined || tier === null) {
    return null;
  }

  let max = 0;
  try {
    max = StaminaManager.getMaxStamina(category, tier, data.staminaMax);
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
          timestamp,
        ).amount,
      ),
      max,
    };
  }

  return { current: baseCurrent, max };
};
