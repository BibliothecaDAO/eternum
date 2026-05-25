import { StaminaManager } from "@bibliothecadao/eternum";
import { ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";

import { getAuthoritativeTroopsSnapshot, getFreshPendingStaminaSource } from "./source-store";
import { ArmyStaminaSourceKind, ArmyStaminaSourceSnapshot } from "./types";

export interface ExplorerArmyFallback {
  category: TroopType;
  tier: TroopTier;
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
}

interface ExplorerStaminaSnapshotInput {
  entityId?: ID;
  currentArmiesTick: number;
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}

const SOURCE_PRIORITY: Record<ArmyStaminaSourceKind, number> = {
  pending: 0,
  snapshot: 1,
  live: 2,
  cached: 3,
};

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

const buildSnapshotCandidate = (input: {
  source: ArmyStaminaSourceKind;
  entityId?: ID;
  troops?: Troops | null;
  capturedAtMs?: number;
}): ArmyStaminaSourceSnapshot | null => {
  if (!input.troops) {
    return null;
  }

  return {
    source: input.source,
    entityId: (input.entityId ?? 0) as ID,
    amount: input.troops.stamina?.amount ?? 0n,
    updatedTick: Number(input.troops.stamina?.updated_tick ?? 0n),
    troopCount: Number(input.troops.count ?? 0n),
    capturedAtMs: input.capturedAtMs,
    troops: input.troops,
  };
};

const buildPendingTroopsSnapshot = (input: {
  entityId?: ID;
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackTroops?: Troops | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}): ArmyStaminaSourceSnapshot | null => {
  const pendingSource = input.pendingStamina
    ? {
        source: "pending" as const,
        entityId: (input.entityId ?? 0) as ID,
        amount: input.pendingStamina.amount,
        updatedTick: input.pendingStamina.updatedTick,
      }
    : input.entityId
      ? getFreshPendingStaminaSource(input.entityId)
      : undefined;
  if (!pendingSource) {
    return null;
  }

  const baseTroops = input.snapshotTroops ?? input.liveTroops ?? input.fallbackTroops;
  if (!baseTroops) {
    return null;
  }

  if (
    hasOnchainStaminaCaughtUpToPending([input.liveTroops, input.snapshotTroops, input.fallbackTroops], pendingSource)
  ) {
    return null;
  }

  return {
    ...pendingSource,
    troops: {
      ...baseTroops,
      stamina: {
        ...(baseTroops.stamina ?? { amount: 0n, updated_tick: 0n }),
        amount: pendingSource.amount,
        updated_tick: BigInt(pendingSource.updatedTick),
      },
    },
  };
};

const hasOnchainStaminaCaughtUpToPending = (
  onchainTroops: Array<Troops | null | undefined>,
  pendingSource: { amount: bigint; updatedTick: number },
): boolean =>
  onchainTroops.some((troops) => {
    if (!troops?.stamina) {
      return false;
    }

    const onchainTick = Number(troops.stamina.updated_tick);
    if (!Number.isFinite(onchainTick)) {
      return false;
    }

    if (onchainTick > pendingSource.updatedTick) {
      return true;
    }

    return onchainTick === pendingSource.updatedTick && troops.stamina.amount === pendingSource.amount;
  });

const compareSnapshots = (
  left: ArmyStaminaSourceSnapshot,
  right: ArmyStaminaSourceSnapshot,
): ArmyStaminaSourceSnapshot => {
  if (left.updatedTick !== right.updatedTick) {
    return left.updatedTick > right.updatedTick ? left : right;
  }

  if (SOURCE_PRIORITY[left.source] !== SOURCE_PRIORITY[right.source]) {
    return SOURCE_PRIORITY[left.source] < SOURCE_PRIORITY[right.source] ? left : right;
  }

  return (left.capturedAtMs ?? 0) >= (right.capturedAtMs ?? 0) ? left : right;
};

export const selectFreshestArmyStaminaSource = (input: {
  entityId?: ID;
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}): ArmyStaminaSourceSnapshot | null => {
  const fallbackTroops = input.fallbackArmy ? buildFallbackTroopsSnapshot(input.fallbackArmy) : null;
  const authoritativeSnapshot = input.entityId ? getAuthoritativeTroopsSnapshot(input.entityId) : undefined;
  const candidates = [
    buildPendingTroopsSnapshot({
      entityId: input.entityId,
      snapshotTroops: input.snapshotTroops ?? authoritativeSnapshot?.troops ?? null,
      liveTroops: input.liveTroops,
      fallbackTroops,
      pendingStamina: input.pendingStamina,
    }),
    authoritativeSnapshot,
    buildSnapshotCandidate({ source: "snapshot", entityId: input.entityId, troops: input.snapshotTroops }),
    buildSnapshotCandidate({ source: "live", entityId: input.entityId, troops: input.liveTroops }),
    buildSnapshotCandidate({ source: "cached", entityId: input.entityId, troops: fallbackTroops }),
  ].filter((candidate): candidate is ArmyStaminaSourceSnapshot => candidate !== null && candidate !== undefined);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce(compareSnapshots);
};

export const selectFreshestTroopsSnapshot = (input: {
  entityId?: ID;
  snapshotTroops?: Troops | null;
  liveTroops?: Troops | null;
  fallbackArmy?: ExplorerArmyFallback | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}): Troops | null => {
  return selectFreshestArmyStaminaSource(input)?.troops ?? null;
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
