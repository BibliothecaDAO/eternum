import { StaminaManager } from "@bibliothecadao/eternum";
import { Troops, TroopTier, TroopType } from "@bibliothecadao/types";

interface ExplorerArmyFallback {
  category: TroopType;
  tier: TroopTier;
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
}

interface ExplorerStaminaSnapshotInput {
  currentArmiesTick: number;
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
}

const resolveExplorerTroopsForStamina = (input: {
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
}): Troops | null => {
  if (input.liveTroops) {
    return input.liveTroops;
  }

  if (input.snapshotTroops) {
    return input.snapshotTroops;
  }

  if (!input.fallbackArmy) {
    return null;
  }

  return {
    category: input.fallbackArmy.category,
    tier: input.fallbackArmy.tier,
    count: BigInt(input.fallbackArmy.troopCount),
    stamina: {
      amount: input.fallbackArmy.onChainStamina.amount,
      updated_tick: BigInt(input.fallbackArmy.onChainStamina.updatedTick),
    },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_tick: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_tick: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_tick_count: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_tick: 0,
    },
    battle_cooldown_end: 0,
  };
};

export const getExplorerStaminaSnapshot = (
  input: ExplorerStaminaSnapshotInput,
): { current: number; max: number; stamina: { amount: bigint; updated_tick: bigint }; troops: Troops } | null => {
  const troops = resolveExplorerTroopsForStamina(input);
  if (!troops) {
    return null;
  }

  const stamina = StaminaManager.getStamina(troops, input.currentArmiesTick);

  return {
    current: Number(stamina.amount),
    max: StaminaManager.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier),
    stamina,
    troops,
  };
};
