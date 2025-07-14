import { RealmLevels, ResourcesIds, type ResourceCost } from "@bibliothecadao/types";

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
export const VILLAGE_MAX_LEVEL = 2;
export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],
  [RealmLevels.City]: [
    { resource: ResourcesIds.Labor, amount: 2_000 },
    { resource: ResourcesIds.Wheat, amount: 1_200 },
    { resource: ResourcesIds.Wood, amount: 200 },
  ],
  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 4_000 },
    { resource: ResourcesIds.Wheat, amount: 3_600 },
    { resource: ResourcesIds.Wood, amount: 1_200 },
    { resource: ResourcesIds.Stone, amount: 600 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 8_000 },
    { resource: ResourcesIds.Wheat, amount: 7_200 },
    { resource: ResourcesIds.Wood, amount: 4_800 },
    { resource: ResourcesIds.Stone, amount: 1_800 },
    { resource: ResourcesIds.Coal, amount: 1_200 },
    { resource: ResourcesIds.Copper, amount: 1_200 },
  ],
};
