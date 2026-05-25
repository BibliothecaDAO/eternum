import type { StructureTileSystemUpdate } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import type { StructureInfo } from "../types";
import { getBattleTimerLeft, getCombatAngles } from "../utils/combat-directions";

const STALE_PENDING_LABEL_UPDATE_AGE_MS = 30_000;

type StructureOwnerState = StructureInfo["owner"];
type StructureGuardArmies = StructureInfo["guardArmies"];
type StructureActiveProductions = StructureInfo["activeProductions"];

export interface PendingLabelUpdate {
  guardArmies?: StructureGuardArmies;
  activeProductions?: StructureActiveProductions;
  owner: StructureOwnerState;
  timestamp: number;
  updateType: "structure" | "building";
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

interface ResolvedStructureBattleState {
  attackedFromDegrees?: number;
  attackTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

interface ResolveStructureTileUpdateRecordInput {
  update: Pick<StructureTileSystemUpdate, "owner" | "guardArmies" | "activeProductions" | "battleData" | "hexCoords">;
  existingStructure?: Pick<StructureInfo, "owner" | "activeProductions">;
  pendingUpdate?: PendingLabelUpdate;
  resolveLiveOwner?: (owner: StructureOwnerState) => Pick<StructureOwnerState, "address" | "ownerName"> | undefined;
}

export interface ResolvedStructureTileUpdateRecord {
  owner: StructureOwnerState;
  guardArmies?: StructureGuardArmies;
  activeProductions?: StructureActiveProductions;
  battle: ResolvedStructureBattleState;
}

const resolveIncomingOwnerState = (
  incomingOwner: Partial<StructureOwnerState>,
  existingOwner?: StructureOwnerState,
): StructureOwnerState => {
  const resolvedIncomingOwner = {
    address: incomingOwner.address || 0n,
    ownerName: incomingOwner.ownerName || "",
    guildName: incomingOwner.guildName || "",
  };

  if (
    (!incomingOwner.address || incomingOwner.address === 0n) &&
    existingOwner?.address &&
    existingOwner.address !== 0n
  ) {
    return existingOwner;
  }

  return resolvedIncomingOwner;
};

const resolveAuthoritativeActiveProductions = (
  incomingActiveProductions: StructureActiveProductions,
  existingStructure?: Pick<StructureInfo, "activeProductions">,
): StructureActiveProductions => {
  if (existingStructure?.activeProductions && existingStructure.activeProductions.length > 0) {
    return existingStructure.activeProductions;
  }

  return incomingActiveProductions;
};

const resolveTileUpdateBattleState = (
  update: Pick<StructureTileSystemUpdate, "battleData" | "hexCoords">,
): ResolvedStructureBattleState => {
  const battleData = update.battleData ?? {};
  let { battleCooldownEnd } = battleData as { battleCooldownEnd?: number };
  const {
    latestAttackerId,
    latestDefenderId,
    latestAttackerCoordX,
    latestAttackerCoordY,
    latestDefenderCoordX,
    latestDefenderCoordY,
  } = battleData as {
    latestAttackerId?: number;
    latestDefenderId?: number;
    latestAttackerCoordX?: number;
    latestAttackerCoordY?: number;
    latestDefenderCoordX?: number;
    latestDefenderCoordY?: number;
  };

  const { attackedFromDegrees, attackTowardDegrees } = getCombatAngles(
    update.hexCoords,
    latestAttackerId ?? undefined,
    latestAttackerCoordX && latestAttackerCoordY ? { x: latestAttackerCoordX, y: latestAttackerCoordY } : undefined,
    latestDefenderId ?? undefined,
    latestDefenderCoordX && latestDefenderCoordY ? { x: latestDefenderCoordX, y: latestDefenderCoordY } : undefined,
  );

  return {
    attackedFromDegrees: attackedFromDegrees ?? undefined,
    attackTowardDegrees: attackTowardDegrees ?? undefined,
    battleCooldownEnd,
    battleTimerLeft: getBattleTimerLeft(battleCooldownEnd),
  };
};

const mergePendingStructureOwner = (
  owner: StructureOwnerState,
  pendingUpdate: PendingLabelUpdate,
): StructureOwnerState => {
  const pendingOwner = pendingUpdate.owner;
  const hasPendingAddress = pendingOwner.address !== undefined && pendingOwner.address !== null;
  const shouldApplyPendingAddress =
    hasPendingAddress &&
    (pendingUpdate.updateType === "structure" || pendingOwner.address !== 0n || owner.address === 0n);

  return {
    address: shouldApplyPendingAddress ? pendingOwner.address : owner.address,
    ownerName: pendingOwner.ownerName || owner.ownerName,
    guildName: pendingOwner.guildName || owner.guildName,
  };
};

const applyPendingStructureUpdate = (
  resolvedUpdate: ResolvedStructureTileUpdateRecord,
  pendingUpdate?: PendingLabelUpdate,
): ResolvedStructureTileUpdateRecord => {
  if (!pendingUpdate) {
    return resolvedUpdate;
  }

  const battle = { ...resolvedUpdate.battle };

  if (pendingUpdate.attackedFromDegrees !== undefined) {
    battle.attackedFromDegrees = pendingUpdate.attackedFromDegrees;
  }

  if (pendingUpdate.attackedTowardDegrees !== undefined) {
    battle.attackTowardDegrees = pendingUpdate.attackedTowardDegrees;
  }

  if (pendingUpdate.battleCooldownEnd !== undefined) {
    battle.battleCooldownEnd = pendingUpdate.battleCooldownEnd;
    battle.battleTimerLeft = getBattleTimerLeft(pendingUpdate.battleCooldownEnd);
  }

  return {
    owner: mergePendingStructureOwner(resolvedUpdate.owner, pendingUpdate),
    guardArmies: pendingUpdate.guardArmies ?? resolvedUpdate.guardArmies,
    activeProductions: pendingUpdate.activeProductions ?? resolvedUpdate.activeProductions,
    battle,
  };
};

const applyLiveOwnerOverride = (
  owner: StructureOwnerState,
  liveOwner?: Pick<StructureOwnerState, "address" | "ownerName">,
): StructureOwnerState => {
  if (!liveOwner) {
    return owner;
  }

  return {
    address: liveOwner.address,
    ownerName: liveOwner.ownerName || owner.ownerName,
    guildName: owner.guildName,
  };
};

export const takeFreshPendingLabelUpdate = (
  pendingLabelUpdates: Map<ID, PendingLabelUpdate>,
  entityId: ID,
  nowMs: number = Date.now(),
): PendingLabelUpdate | undefined => {
  const pendingUpdate = pendingLabelUpdates.get(entityId);
  if (!pendingUpdate) {
    return undefined;
  }

  pendingLabelUpdates.delete(entityId);
  if (nowMs - pendingUpdate.timestamp > STALE_PENDING_LABEL_UPDATE_AGE_MS) {
    return undefined;
  }

  return pendingUpdate;
};

export const resolveStructureTileUpdateRecord = ({
  update,
  existingStructure,
  pendingUpdate,
  resolveLiveOwner,
}: ResolveStructureTileUpdateRecordInput): ResolvedStructureTileUpdateRecord => {
  const resolvedWithoutPending = {
    owner: resolveIncomingOwnerState(update.owner, existingStructure?.owner),
    guardArmies: update.guardArmies,
    activeProductions: resolveAuthoritativeActiveProductions(update.activeProductions, existingStructure),
    battle: resolveTileUpdateBattleState(update),
  };

  const resolvedWithPending = applyPendingStructureUpdate(resolvedWithoutPending, pendingUpdate);

  return {
    ...resolvedWithPending,
    owner: applyLiveOwnerOverride(resolvedWithPending.owner, resolveLiveOwner?.(resolvedWithPending.owner)),
  };
};
