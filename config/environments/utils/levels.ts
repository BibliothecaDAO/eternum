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
    { resource: ResourcesIds.Wheat, amount: 2_400 },
    { resource: ResourcesIds.Essence, amount: 600 },
    { resource: ResourcesIds.Wood, amount: 180 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 720 },
    { resource: ResourcesIds.Wheat, amount: 4_800 },
    { resource: ResourcesIds.Essence, amount: 1_200 },
    { resource: ResourcesIds.Wood, amount: 360 },
    { resource: ResourcesIds.Coal, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 180 },
  ],
};
