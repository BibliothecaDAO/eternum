import { type HyperstructureResourceCostMinMax, type ID, type Resource, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";
import { configManager } from "../managers/config-manager";

// used for entities that don't have any production; undefined when the entity's resources are unknown here
export const getInventoryResources = (entityId: ID, store: NativeFactStore): Resource[] | undefined =>
  new ResourceManager(store, entityId).balances();

// for entities that have production like realms
export const getBalance = (
  entityId: ID,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  store: NativeFactStore,
) => {
  const resourceManager = new ResourceManager(store, entityId);
  return {
    // Undefined when this client holds no resource owner for the entity: unknown, never zero.
    balance: resourceManager.balanceWithProduction(currentDefaultTick, resourceId)?.balance,
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
