import { ResourcesIds } from "@bibliothecadao/types";

export type ProductionSortItem = {
  resourceId: ResourcesIds;
  isProducing: boolean;
};

export const createProductionSortComparator =
  <T extends ProductionSortItem>(starvedResources?: Map<ResourcesIds, string>) =>
  (a: T, b: T): number => {
    const aStarved = starvedResources?.has(a.resourceId) ? 1 : 0;
    const bStarved = starvedResources?.has(b.resourceId) ? 1 : 0;
    if (aStarved !== bStarved) return bStarved - aStarved;

    const aProducing = a.isProducing ? 1 : 0;
    const bProducing = b.isProducing ? 1 : 0;
    if (aProducing !== bProducing) return aProducing - bProducing;

    if (a.resourceId === ResourcesIds.Wheat && b.resourceId !== ResourcesIds.Wheat) return -1;
    if (b.resourceId === ResourcesIds.Wheat && a.resourceId !== ResourcesIds.Wheat) return 1;
    return a.resourceId - b.resourceId;
  };
