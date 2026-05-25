import type { BuildingType, ID } from "@bibliothecadao/types";
import { getBattleTimerLeft } from "../utils/combat-directions";
import type { GuardArmy } from "../../../../../../packages/core/src/stores/map-data-store";
import type { PendingLabelUpdate } from "./structure-update-reconciliation";

export const mapPendingStructureGuardArmies = (
  guardArmies: GuardArmy[],
): NonNullable<PendingLabelUpdate["guardArmies"]> =>
  guardArmies.map((guard) => ({
    slot: guard.slot,
    category: guard.category,
    tier: guard.tier,
    count: guard.count,
    stamina: guard.stamina,
  }));

const shouldReplacePendingLabelUpdate = (existingPending: PendingLabelUpdate | undefined, nowMs: number): boolean =>
  !existingPending || nowMs >= existingPending.timestamp;

export function queuePendingStructureLabelUpdate(input: {
  pendingLabelUpdates: Map<ID, PendingLabelUpdate>;
  entityId: ID;
  owner: PendingLabelUpdate["owner"];
  guardArmies: GuardArmy[];
  battleCooldownEnd: number;
  nowMs?: number;
}): void {
  const nowMs = input.nowMs ?? Date.now();
  const existingPending = input.pendingLabelUpdates.get(input.entityId);
  if (!shouldReplacePendingLabelUpdate(existingPending, nowMs)) {
    return;
  }

  const nextPending = existingPending ?? {
    owner: { ...input.owner },
    timestamp: nowMs,
    updateType: "structure" as const,
  };

  nextPending.guardArmies = mapPendingStructureGuardArmies(input.guardArmies);
  nextPending.owner = { ...input.owner };
  nextPending.timestamp = nowMs;
  nextPending.updateType = "structure";
  nextPending.battleCooldownEnd = input.battleCooldownEnd;
  nextPending.battleTimerLeft = getBattleTimerLeft(input.battleCooldownEnd);

  input.pendingLabelUpdates.set(input.entityId, nextPending);
}

export function queuePendingBuildingLabelUpdate(input: {
  pendingLabelUpdates: Map<ID, PendingLabelUpdate>;
  entityId: ID;
  activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>;
  nowMs?: number;
}): void {
  const nowMs = input.nowMs ?? Date.now();
  const existingPending = input.pendingLabelUpdates.get(input.entityId);
  if (!shouldReplacePendingLabelUpdate(existingPending, nowMs)) {
    return;
  }

  const nextPending = existingPending ?? {
    owner: { address: 0n, ownerName: "", guildName: "" },
    timestamp: nowMs,
    updateType: "building" as const,
  };

  nextPending.activeProductions = input.activeProductions;
  nextPending.timestamp = nowMs;
  nextPending.updateType = "building";

  input.pendingLabelUpdates.set(input.entityId, nextPending);
}
