import { pickFresherArmyStaminaReading, StaminaManager } from "@bibliothecadao/eternum";
import { ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";

import { getFreshPendingStaminaSource } from "./source-store";
import { ArmyStaminaSourceSnapshot } from "./types";

interface ExplorerStaminaSnapshotInput {
  entityId?: ID;
  currentArmiesTick: number;
  liveTroops?: Troops | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}

export const getTroopsStaminaUpdatedTick = (troops: Troops | null | undefined): bigint => {
  const updatedTick = troops?.stamina?.updated_tick;
  return typeof updatedTick === "bigint" ? updatedTick : 0n;
};

const buildLiveCandidate = (input: { entityId?: ID; troops?: Troops | null }): ArmyStaminaSourceSnapshot | null => {
  if (!input.troops) {
    return null;
  }

  return {
    source: "live",
    entityId: (input.entityId ?? 0) as ID,
    amount: input.troops.stamina?.amount ?? 0n,
    updatedTick: Number(input.troops.stamina?.updated_tick ?? 0n),
    troopCount: Number(input.troops.count ?? 0n),
    troops: input.troops,
  };
};

const buildPendingTroopsSnapshot = (input: {
  entityId?: ID;
  liveTroops?: Troops | null;
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

  const baseTroops = input.liveTroops;
  if (!baseTroops) {
    return null;
  }

  if (hasLiveStaminaCaughtUpToPending(input.liveTroops, pendingSource)) {
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

const hasLiveStaminaCaughtUpToPending = (
  liveTroops: Troops | null | undefined,
  pendingSource: { amount: bigint; updatedTick: number },
): boolean => {
  if (!liveTroops?.stamina) return false;

  const liveTick = Number(liveTroops.stamina.updated_tick);
  if (!Number.isFinite(liveTick)) return false;

  if (liveTick > pendingSource.updatedTick) return true;

  return liveTick === pendingSource.updatedTick && liveTroops.stamina.amount === pendingSource.amount;
};

export const selectFreshestArmyStaminaSource = (input: {
  entityId?: ID;
  liveTroops?: Troops | null;
  pendingStamina?: {
    amount: bigint;
    updatedTick: number;
  } | null;
}): ArmyStaminaSourceSnapshot | null => {
  const candidates = [
    buildPendingTroopsSnapshot({
      entityId: input.entityId,
      liveTroops: input.liveTroops,
      pendingStamina: input.pendingStamina,
    }),
    buildLiveCandidate({ entityId: input.entityId, troops: input.liveTroops }),
  ].filter((candidate): candidate is ArmyStaminaSourceSnapshot => candidate !== null && candidate !== undefined);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((left, right) => pickFresherArmyStaminaReading(left, right));
};

export const selectFreshestTroopsSnapshot = (input: {
  entityId?: ID;
  liveTroops?: Troops | null;
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
