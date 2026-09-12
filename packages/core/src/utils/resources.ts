import {
  type ClientComponents,
  type HyperstructureResourceCostMinMax,
  type ID,
  type Resource,
  ResourcesIds,
  StructureType,
  resources,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { ResourceManager } from "../managers";
import { getIsBlitz } from "./utils";
import { gameEntityKey } from "../managers/config-manager";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resourceManager = new ResourceManager(components, entityId);
      const balance = resourceManager.balance(id);
      if (balance > 0) {
        return { resourceId: id, amount: Number(balance) };
      }
      return undefined;
    })
    .filter((resource): resource is Resource => resource !== undefined);
};

// for entities that have production like realms
export const getBalance = (
  entityId: ID,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const resourceManager = new ResourceManager(components, entityId);
  return {
    balance: resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance,
    resourceId,
  };
};

export const scaleHyperstructureConstructionCostMinMax = (
  resourceCost: HyperstructureResourceCostMinMax[],
  multiplier: number,
): HyperstructureResourceCostMinMax[] => {
  return resourceCost.map((resource) => ({
    ...resource,
    min_amount: resource.min_amount * multiplier,
    max_amount: resource.max_amount * multiplier,
  }));
};

export const isMilitaryResource = (resourceId: ResourcesIds) => {
  return (
    resourceId === ResourcesIds.Knight ||
    resourceId === ResourcesIds.KnightT2 ||
    resourceId === ResourcesIds.KnightT3 ||
    resourceId === ResourcesIds.Paladin ||
    resourceId === ResourcesIds.PaladinT2 ||
    resourceId === ResourcesIds.PaladinT3 ||
    resourceId === ResourcesIds.Crossbowman ||
    resourceId === ResourcesIds.CrossbowmanT2 ||
    resourceId === ResourcesIds.CrossbowmanT3
  );
};

export const canTransferMilitaryResources = (fromEntityId: ID, toEntityId: ID, components: ClientComponents) => {
  const fromStructure = getComponentValue(components.Structure, gameEntityKey([BigInt(fromEntityId)]));

  const toStructure = getComponentValue(components.Structure, gameEntityKey([BigInt(toEntityId)]));

  if (getIsBlitz()) {
    return Boolean(fromStructure && toStructure && fromStructure.owner === toStructure.owner);
  }

  // If from structure is a village, can only transfer to its connected realm
  if (fromStructure?.category === StructureType.Village) {
    return toStructure?.entity_id === fromStructure.metadata.village_realm;
  }

  // If to structure is a village, can only transfer from its connected realm
  if (toStructure?.category === StructureType.Village) {
    return fromStructure?.entity_id === toStructure.metadata.village_realm;
  }

  // Otherwise, transfer is allowed
  return true;
};
