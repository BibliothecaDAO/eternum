import type { ID, TroopTier, TroopType } from "@bibliothecadao/types";

import { getBattleTimerLeft } from "../utils/combat-directions";
import { resolveArmyOwnerState } from "./army-owner-resolution";

const STALE_PENDING_EXPLORER_UPDATE_AGE_MS = 30_000;

export interface PendingExplorerTroopsUpdate {
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  ownerAddress: bigint;
  ownerName: string;
  timestamp: number;
  updateTick: number;
  ownerStructureId?: ID | null;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

interface ResolvePendingArmySpawnStateInput {
  troopCount: number;
  currentStamina: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  owner: { address: bigint | undefined; ownerName: string; guildName: string };
  owningStructureId?: ID | null;
  category: TroopType;
  tier: TroopTier;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
  attackedFromDegrees?: number;
  attackTowardDegrees?: number;
  pendingUpdate?: PendingExplorerTroopsUpdate;
  resolveCurrentStamina: (input: {
    troopCount: number;
    onChainStamina: { amount: bigint; updatedTick: number };
    category: TroopType;
    tier: TroopTier;
  }) => number;
}

export const takeFreshPendingExplorerTroopsUpdate = (
  pendingExplorerTroopsUpdate: Map<ID, PendingExplorerTroopsUpdate>,
  entityId: ID,
  nowMs: number = Date.now(),
): PendingExplorerTroopsUpdate | undefined => {
  const pendingUpdate = pendingExplorerTroopsUpdate.get(entityId);
  if (!pendingUpdate) {
    return undefined;
  }

  pendingExplorerTroopsUpdate.delete(entityId);
  if (nowMs - pendingUpdate.timestamp > STALE_PENDING_EXPLORER_UPDATE_AGE_MS) {
    return undefined;
  }

  return pendingUpdate;
};

export const queuePendingExplorerTroopsUpdate = (input: {
  pendingExplorerTroopsUpdate: Map<ID, PendingExplorerTroopsUpdate>;
  entityId: ID;
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  ownerAddress: bigint;
  ownerName: string;
  ownerStructureId?: ID | null;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  updateTick: number;
  nowMs?: number;
}): void => {
  const existingPending = input.pendingExplorerTroopsUpdate.get(input.entityId);
  if (existingPending && input.updateTick < existingPending.updateTick) {
    return;
  }

  input.pendingExplorerTroopsUpdate.set(input.entityId, {
    troopCount: input.troopCount,
    onChainStamina: input.onChainStamina,
    ownerAddress: input.ownerAddress,
    ownerName: input.ownerName,
    timestamp: input.nowMs ?? Date.now(),
    updateTick: input.updateTick,
    ownerStructureId: input.ownerStructureId ?? null,
    attackedFromDegrees: input.attackedFromDegrees,
    attackedTowardDegrees: input.attackedTowardDegrees,
    battleCooldownEnd: input.battleCooldownEnd,
    battleTimerLeft: getBattleTimerLeft(input.battleCooldownEnd),
  });
};

export const resolvePendingArmySpawnState = (input: ResolvePendingArmySpawnStateInput) => {
  if (!input.pendingUpdate) {
    return {
      troopCount: input.troopCount,
      currentStamina: input.currentStamina,
      onChainStamina: input.onChainStamina,
      owner: {
        address: input.owner.address ?? 0n,
        ownerName: input.owner.ownerName,
        guildName: input.owner.guildName,
      },
      owningStructureId: input.owningStructureId ?? null,
      attackedFromDegrees: input.attackedFromDegrees,
      attackTowardDegrees: input.attackTowardDegrees,
      battleCooldownEnd: input.battleCooldownEnd,
      battleTimerLeft: input.battleTimerLeft,
    };
  }

  const resolvedOwner = resolveArmyOwnerState({
    existingOwner: input.owner,
    incomingOwner: {
      address: input.pendingUpdate.ownerAddress,
      ownerName: input.pendingUpdate.ownerName,
      guildName: input.owner.guildName,
    },
  });

  return {
    troopCount: input.pendingUpdate.troopCount,
    currentStamina: input.resolveCurrentStamina({
      troopCount: input.pendingUpdate.troopCount,
      onChainStamina: input.pendingUpdate.onChainStamina,
      category: input.category,
      tier: input.tier,
    }),
    onChainStamina: input.pendingUpdate.onChainStamina,
    owner: resolvedOwner,
    owningStructureId:
      input.pendingUpdate.ownerStructureId !== undefined && input.pendingUpdate.ownerStructureId !== null
        ? input.pendingUpdate.ownerStructureId
        : (input.owningStructureId ?? null),
    attackedFromDegrees:
      input.pendingUpdate.attackedFromDegrees !== undefined
        ? input.pendingUpdate.attackedFromDegrees
        : input.attackedFromDegrees,
    attackTowardDegrees:
      input.pendingUpdate.attackedTowardDegrees !== undefined
        ? input.pendingUpdate.attackedTowardDegrees
        : input.attackTowardDegrees,
    battleCooldownEnd:
      input.pendingUpdate.battleCooldownEnd !== undefined
        ? input.pendingUpdate.battleCooldownEnd
        : input.battleCooldownEnd,
    battleTimerLeft:
      input.pendingUpdate.battleCooldownEnd !== undefined
        ? getBattleTimerLeft(input.pendingUpdate.battleCooldownEnd)
        : input.battleTimerLeft,
  };
};
