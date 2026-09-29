import { type ID, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";

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
