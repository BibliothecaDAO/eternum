import { type ID, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";

// for entities that have production like realms
export const getBalance = (
  entityId: ID | undefined,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  store: NativeFactStore,
) => ({
  // Undefined without an entity, or when this client holds no resource owner for it: unknown, never zero.
  balance:
    entityId === undefined
      ? undefined
      : new ResourceManager(store, entityId).balanceWithProduction(currentDefaultTick, resourceId)?.balance,
  resourceId,
});

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
