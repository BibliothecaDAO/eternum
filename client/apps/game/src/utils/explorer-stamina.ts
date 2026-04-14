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

const buildFallbackTroopsSnapshot = (fallbackArmy: ExplorerArmyFallback): Troops => ({
  category: fallbackArmy.category,
  tier: fallbackArmy.tier,
  count: BigInt(fallbackArmy.troopCount),
  stamina: {
    amount: fallbackArmy.onChainStamina.amount,
    updated_tick: BigInt(fallbackArmy.onChainStamina.updatedTick),
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
});

export const getTroopsStaminaUpdatedTick = (troops: Troops | null | undefined): bigint => {
  const updatedTick = troops?.stamina?.updated_tick;
  return typeof updatedTick === "bigint" ? updatedTick : 0n;
};

export const selectFreshestTroopsSnapshot = (input: {
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
}): Troops | null => {
  const fallbackTroops = input.fallbackArmy ? buildFallbackTroopsSnapshot(input.fallbackArmy) : null;
  const candidates = [input.liveTroops ?? null, input.snapshotTroops ?? null, fallbackTroops];
  const availableCandidates = candidates.filter((candidate): candidate is Troops => candidate !== null);

  if (availableCandidates.length === 0) {
    return null;
  }

  return availableCandidates.reduce((freshest, candidate) => {
    if (getTroopsStaminaUpdatedTick(candidate) > getTroopsStaminaUpdatedTick(freshest)) {
      return candidate;
    }

    return freshest;
  });
};

export const getExplorerStaminaSnapshot = (
  input: ExplorerStaminaSnapshotInput,
): { current: number; max: number; stamina: { amount: bigint; updated_tick: bigint }; troops: Troops } | null => {
  const troops = selectFreshestTroopsSnapshot(input);
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
