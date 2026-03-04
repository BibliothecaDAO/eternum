import { type BuildingType, type ID } from "@bibliothecadao/types";

interface IsBuildPendingForStructureTypeInput {
  entityId: ID;
  buildingType: BuildingType;
  localPendingByTypeKey: Record<string, boolean>;
  getPendingCountForStructureAndType: (structureEntityId: ID, buildingType: BuildingType) => number;
}

export function isBuildPendingForStructureType(input: IsBuildPendingForStructureTypeInput): boolean {
  const localPending = Boolean(input.localPendingByTypeKey[input.buildingType.toString()]);
  if (localPending) {
    return true;
  }

  return input.getPendingCountForStructureAndType(input.entityId, input.buildingType) > 0;
}
