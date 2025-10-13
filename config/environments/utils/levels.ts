import { RealmLevels, ResourcesIds, type ResourceCost } from "@bibliothecadao/types";

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
export const VILLAGE_MAX_LEVEL = 1;
export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],
  [RealmLevels.City]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wheat, amount: 1_200 },
    { resource: ResourcesIds.Essence, amount: 200 },
  ],
  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 360 },
    { resource: ResourcesIds.Wheat, amount: 3_600 },
    { resource: ResourcesIds.Essence, amount: 800 },
    { resource: ResourcesIds.Wood, amount: 360 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 720 },
    { resource: ResourcesIds.Wheat, amount: 7_200 },
    { resource: ResourcesIds.Essence, amount: 1_600 },
    { resource: ResourcesIds.Wood, amount: 720 },
    { resource: ResourcesIds.Coal, amount: 360 },
    { resource: ResourcesIds.Copper, amount: 360 },
  ],
};
