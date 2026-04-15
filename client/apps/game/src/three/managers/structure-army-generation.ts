import { ResourceManager } from "@bibliothecadao/eternum";
import { type ClientComponents, type ID, ResourcesIds } from "@bibliothecadao/types";
import { getComponentValue, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { StructureArmyGeneration } from "../types";

const TROOP_PRODUCTION_RESOURCE_IDS: readonly ResourcesIds[] = [
  ResourcesIds.Knight,
  ResourcesIds.KnightT2,
  ResourcesIds.KnightT3,
  ResourcesIds.Crossbowman,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.Paladin,
  ResourcesIds.PaladinT2,
  ResourcesIds.PaladinT3,
];

export const resolveActiveArmyGenerationFromResource = (input: {
  resource: ComponentValue<ClientComponents["Resource"]["schema"]> | null | undefined;
  currentDefaultTick: number;
}): StructureArmyGeneration[] => {
  if (!input.resource) {
    return [];
  }

  const activeArmyGeneration: StructureArmyGeneration[] = [];

  TROOP_PRODUCTION_RESOURCE_IDS.forEach((resourceId) => {
    if (!ResourceManager.isActiveStatic(input.resource!, resourceId)) {
      return;
    }

    const productionInfo = ResourceManager.balanceAndProduction(input.resource!, resourceId);
    const productionData = ResourceManager.calculateResourceProductionData(
      resourceId,
      productionInfo,
      input.currentDefaultTick,
    );
    const buildingCount = Number(productionInfo.production?.building_count ?? 0);

    if (!productionData.isProducing || !Number.isFinite(buildingCount) || buildingCount <= 0) {
      return;
    }

    activeArmyGeneration.push({
      resourceId,
      buildingCount,
    });
  });

  return activeArmyGeneration;
};

export const resolveStructureActiveArmyGeneration = (input: {
  components?: ClientComponents;
  structureEntityId: ID;
  currentDefaultTick: number;
}): StructureArmyGeneration[] => {
  if (!input.components?.Resource) {
    return [];
  }

  const resource = getComponentValue(input.components.Resource, getEntityIdFromKeys([BigInt(input.structureEntityId)]));
  return resolveActiveArmyGenerationFromResource({
    resource,
    currentDefaultTick: input.currentDefaultTick,
  });
};

export const isSameStructureArmyGeneration = (
  left: StructureArmyGeneration[] | undefined,
  right: StructureArmyGeneration[] | undefined,
): boolean => {
  const safeLeft = left ?? [];
  const safeRight = right ?? [];

  if (safeLeft.length !== safeRight.length) {
    return false;
  }

  return safeLeft.every(
    (entry, index) =>
      entry.resourceId === safeRight[index]?.resourceId && entry.buildingCount === safeRight[index]?.buildingCount,
  );
};
