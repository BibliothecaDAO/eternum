import type { ID } from "@bibliothecadao/types";

import type { ArmyData } from "../types";
import type { ModelType } from "../types/army";

export const normalizeArmyCosmeticOwner = (owner: string | bigint): string =>
  typeof owner === "bigint"
    ? `0x${owner.toString(16)}`
    : owner.toLowerCase().startsWith("0x")
      ? owner.toLowerCase()
      : owner;

export function refreshVisibleArmyCosmeticsByOwner(input: {
  owner: string | bigint;
  armies: Map<ID, ArmyData>;
  visibleArmyIndices: Map<ID, number>;
  getAssignedModelType: (entityId: number) => ModelType | undefined;
  toNumericId: (entityId: ID) => number;
  refreshArmyInstance: (army: ArmyData, slot: number, assignedModelType: ModelType, reResolveCosmetics: true) => void;
}): ID[] {
  const normalizedOwner = normalizeArmyCosmeticOwner(input.owner);
  const updatedArmyIds: ID[] = [];

  input.armies.forEach((army, entityId) => {
    const armyOwner = `0x${army.owner.address.toString(16)}`;
    if (armyOwner !== normalizedOwner) {
      return;
    }

    const slot = input.visibleArmyIndices.get(entityId);
    if (slot === undefined) {
      return;
    }

    const assignedModelType = input.getAssignedModelType(input.toNumericId(entityId));
    if (!assignedModelType) {
      return;
    }

    input.refreshArmyInstance(army, slot, assignedModelType, true);
    updatedArmyIds.push(entityId);
  });

  return updatedArmyIds;
}
