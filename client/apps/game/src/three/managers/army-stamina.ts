import { StaminaManager } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";

export interface ArmyStaminaBoosts {
  incr_stamina_regen_percent_num: number;
  incr_stamina_regen_tick_count: number;
  incr_explore_reward_percent_num: number;
  incr_explore_reward_end_tick: number;
  incr_damage_dealt_percent_num: number;
  incr_damage_dealt_end_tick: number;
  decr_damage_gotten_percent_num: number;
  decr_damage_gotten_end_tick: number;
}

export interface ArmyStaminaInput {
  troopCategory: TroopType;
  troopTier: TroopTier;
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  currentArmiesTick: number;
  boosts?: Partial<ArmyStaminaBoosts> | null;
}

export const ZERO_ARMY_STAMINA_BOOSTS: ArmyStaminaBoosts = {
  incr_stamina_regen_percent_num: 0,
  incr_stamina_regen_tick_count: 0,
  incr_explore_reward_percent_num: 0,
  incr_explore_reward_end_tick: 0,
  incr_damage_dealt_percent_num: 0,
  incr_damage_dealt_end_tick: 0,
  decr_damage_gotten_percent_num: 0,
  decr_damage_gotten_end_tick: 0,
};

export function resolveArmyStaminaBoosts(boosts?: Partial<ArmyStaminaBoosts> | null): ArmyStaminaBoosts {
  if (!boosts) {
    return { ...ZERO_ARMY_STAMINA_BOOSTS };
  }

  return {
    incr_stamina_regen_percent_num: Number(boosts.incr_stamina_regen_percent_num ?? 0),
    incr_stamina_regen_tick_count: Number(boosts.incr_stamina_regen_tick_count ?? 0),
    incr_explore_reward_percent_num: Number(boosts.incr_explore_reward_percent_num ?? 0),
    incr_explore_reward_end_tick: Number(boosts.incr_explore_reward_end_tick ?? 0),
    incr_damage_dealt_percent_num: Number(boosts.incr_damage_dealt_percent_num ?? 0),
    incr_damage_dealt_end_tick: Number(boosts.incr_damage_dealt_end_tick ?? 0),
    decr_damage_gotten_percent_num: Number(boosts.decr_damage_gotten_percent_num ?? 0),
    decr_damage_gotten_end_tick: Number(boosts.decr_damage_gotten_end_tick ?? 0),
  };
}

export function projectArmyCurrentStamina(input: ArmyStaminaInput): number {
  const stamina = StaminaManager.getStamina(
    {
      category: input.troopCategory,
      tier: input.troopTier,
      count: BigInt(input.troopCount),
      stamina: {
        amount: BigInt(input.onChainStamina.amount),
        updated_tick: BigInt(input.onChainStamina.updatedTick),
      },
      boosts: resolveArmyStaminaBoosts(input.boosts),
      battle_cooldown_end: 0,
    },
    input.currentArmiesTick,
  );

  return Number(stamina.amount);
}
