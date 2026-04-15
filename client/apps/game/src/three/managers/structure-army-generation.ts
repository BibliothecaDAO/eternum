import { ResourceManager } from "@bibliothecadao/eternum";
import { type ClientComponents, type ID, ResourcesIds } from "@bibliothecadao/types";
import { getComponentValue, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { StructureArmyProduction } from "../types";

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

const resolvePendingTroopOutputAmount = (
  production: { output_amount_left: bigint; production_rate: bigint; last_updated_at: number } | undefined,
  currentDefaultTick: number,
): bigint => {
  if (!production) {
    return 0n;
  }

  const elapsedTicks = Math.max(0, currentDefaultTick - production.last_updated_at);
  const producedAmount = BigInt(elapsedTicks) * production.production_rate;
  const pendingAmount = production.output_amount_left - producedAmount;
  return pendingAmount > 0n ? pendingAmount : 0n;
};

export const resolveActiveArmyProductionFromResource = (input: {
  resource: ComponentValue<ClientComponents["Resource"]["schema"]> | null | undefined;
  currentDefaultTick: number;
}): StructureArmyProduction[] => {
  if (!input.resource) {
    return [];
  }

  const activeArmyProduction: StructureArmyProduction[] = [];

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
    const outputPerTick = productionInfo.production?.production_rate ?? 0n;
    const outputAmountLeft = resolvePendingTroopOutputAmount(productionInfo.production, input.currentDefaultTick);

    if (!productionData.isProducing || !Number.isFinite(buildingCount) || buildingCount <= 0 || outputPerTick <= 0n) {
      return;
    }

    activeArmyProduction.push({
      resourceId,
      outputPerTick,
      outputAmountLeft,
      buildingCount,
    });
  });

  return activeArmyProduction;
};

export const resolveStructureActiveArmyProduction = (input: {
  components?: ClientComponents;
  structureEntityId: ID;
  currentDefaultTick: number;
}): StructureArmyProduction[] => {
  if (!input.components?.Resource) {
    return [];
  }

  const resource = getComponentValue(input.components.Resource, getEntityIdFromKeys([BigInt(input.structureEntityId)]));
  return resolveActiveArmyProductionFromResource({
    resource,
    currentDefaultTick: input.currentDefaultTick,
  });
};

export const isSameStructureArmyProduction = (
  left: StructureArmyProduction[] | undefined,
  right: StructureArmyProduction[] | undefined,
): boolean => {
  const safeLeft = left ?? [];
  const safeRight = right ?? [];

  if (safeLeft.length !== safeRight.length) {
    return false;
  }

  return safeLeft.every(
    (entry, index) =>
      entry.resourceId === safeRight[index]?.resourceId &&
      entry.outputPerTick === safeRight[index]?.outputPerTick &&
      entry.outputAmountLeft === safeRight[index]?.outputAmountLeft &&
      entry.buildingCount === safeRight[index]?.buildingCount,
  );
};
