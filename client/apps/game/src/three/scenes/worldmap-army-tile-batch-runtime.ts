import type { HexPosition, ID } from "@bibliothecadao/types";

export interface ArmyHexBatchMutation {
  entityId: ID;
  kind: "remove" | "upsert";
  oldPos?: HexPosition;
  newPos?: HexPosition;
  ownerAddress?: bigint;
  ownerStructureId?: ID | null;
}

export interface ArmyHexBatchApplyPlan {
  occupancyRemovals: Array<{
    entityId: ID;
    position: HexPosition;
  }>;
  trackedRemovals: ID[];
  upserts: Array<{
    entityId: ID;
    newPos: HexPosition;
    ownerAddress: bigint;
    ownerStructureId?: ID | null;
  }>;
}

export function resolveArmyHexBatchApplyPlan(mutations: ArmyHexBatchMutation[]): ArmyHexBatchApplyPlan {
  const occupancyRemovals: ArmyHexBatchApplyPlan["occupancyRemovals"] = [];
  const trackedRemovals: ArmyHexBatchApplyPlan["trackedRemovals"] = [];
  const upserts: ArmyHexBatchApplyPlan["upserts"] = [];

  for (const mutation of mutations) {
    if (mutation.kind === "remove") {
      trackedRemovals.push(mutation.entityId);
      if (mutation.oldPos) {
        occupancyRemovals.push({
          entityId: mutation.entityId,
          position: mutation.oldPos,
        });
      }
      continue;
    }

    if (mutation.oldPos && mutation.newPos) {
      const changedPosition =
        mutation.oldPos.col !== mutation.newPos.col || mutation.oldPos.row !== mutation.newPos.row;
      if (changedPosition) {
        occupancyRemovals.push({
          entityId: mutation.entityId,
          position: mutation.oldPos,
        });
      }
    }

    if (mutation.newPos && mutation.ownerAddress !== undefined) {
      upserts.push({
        entityId: mutation.entityId,
        newPos: mutation.newPos,
        ownerAddress: mutation.ownerAddress,
        ownerStructureId: mutation.ownerStructureId,
      });
    }
  }

  return {
    occupancyRemovals,
    trackedRemovals,
    upserts,
  };
}
