import { RealmLevels, ResourcesIds, type ResourceCost } from "@bibliothecadao/types";

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
export const VILLAGE_MAX_LEVEL = 1;
export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],
  [RealmLevels.City]: [
    { resource: ResourcesIds.Labor, amount: 200 },
    { resource: ResourcesIds.Wheat, amount: 1_200 },
    { resource: ResourcesIds.Essence, amount: 200 },
  ],
  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 400 },
    { resource: ResourcesIds.Wheat, amount: 3_600 },
    { resource: ResourcesIds.Essence, amount: 1_200 },
    { resource: ResourcesIds.Wood, amount: 400 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 800 },
    { resource: ResourcesIds.Wheat, amount: 7_200 },
    { resource: ResourcesIds.Essence, amount: 4_800 },
    { resource: ResourcesIds.Wood, amount: 1_200 },
    { resource: ResourcesIds.Coal, amount: 600 },
    { resource: ResourcesIds.Copper, amount: 600 },
  ],
};
