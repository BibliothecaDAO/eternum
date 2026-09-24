import {
  type HyperstructureResourceCostMinMax,
  type ID,
  type Resource,
  ResourcesIds,
  resources,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";
import { configManager } from "../managers/config-manager";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, store: NativeFactStore): Resource[] => {
  return resources
    .map(({ id }) => {
      const resourceManager = new ResourceManager(store, entityId);
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
  store: NativeFactStore,
) => {
  const resourceManager = new ResourceManager(store, entityId);
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

export const canTransferMilitaryResources = (fromEntityId: ID, toEntityId: ID, store: NativeFactStore) => {
  const game_id = configManager.getActiveGameId();
  const explorer = store.get("ExplorerTroops", { game_id, explorer_id: fromEntityId });
  const home = store.get("Structure", { game_id, entity_id: explorer?.owner ?? fromEntityId });
  const target = store.get("Structure", { game_id, entity_id: toEntityId });
  return home !== undefined && target !== undefined && home.owner === target.owner;
};
