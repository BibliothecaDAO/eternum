import { StaminaManager } from "@bibliothecadao/eternum";
import { Troops, TroopTier, TroopType } from "@bibliothecadao/types";

interface PendingStaminaCandidate {
  amount: bigint;
  updatedTick: number;
}

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
  pendingStamina?: PendingStaminaCandidate | null;
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

const buildPendingTroopsSnapshot = (input: {
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackTroops?: Troops | null;
  pendingStamina?: PendingStaminaCandidate | null;
}): Troops | null => {
  if (!input.pendingStamina) {
    return null;
  }

  const baseTroops = input.snapshotTroops ?? input.liveTroops ?? input.fallbackTroops;
  if (!baseTroops) {
    return null;
  }

  const pendingTick = BigInt(input.pendingStamina.updatedTick);
  const pendingAmount = input.pendingStamina.amount;
  const authoritativeTick = getTroopsStaminaUpdatedTick(baseTroops);
  const authoritativeAmount = baseTroops.stamina?.amount ?? 0n;

  if (authoritativeTick > pendingTick) {
    return null;
  }

  if (authoritativeTick === pendingTick && authoritativeAmount === pendingAmount) {
    return null;
  }

  return {
    ...baseTroops,
    stamina: {
      ...(baseTroops.stamina ?? { amount: 0n, updated_tick: 0n }),
      amount: pendingAmount,
      updated_tick: pendingTick,
    },
  };
};

export const selectFreshestTroopsSnapshot = (input: {
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
  pendingStamina?: PendingStaminaCandidate | null;
}): Troops | null => {
  const fallbackTroops = input.fallbackArmy ? buildFallbackTroopsSnapshot(input.fallbackArmy) : null;
  const pendingTroops = buildPendingTroopsSnapshot({
    snapshotTroops: input.snapshotTroops,
    liveTroops: input.liveTroops,
    fallbackTroops,
    pendingStamina: input.pendingStamina,
  });
  const candidates = [
    { troops: pendingTroops, priority: 0 },
    { troops: input.snapshotTroops ?? null, priority: 1 },
    { troops: input.liveTroops ?? null, priority: 2 },
    { troops: fallbackTroops, priority: 3 },
  ].filter((candidate): candidate is { troops: Troops; priority: number } => candidate.troops !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((freshest, candidate) => {
    const freshestTick = getTroopsStaminaUpdatedTick(freshest.troops);
    const candidateTick = getTroopsStaminaUpdatedTick(candidate.troops);

    if (candidateTick > freshestTick) {
      return candidate;
    }

    if (candidateTick === freshestTick && candidate.priority < freshest.priority) {
      return candidate;
    }

    return freshest;
  }).troops;
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
