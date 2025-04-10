import { RealmLevels, ResourcesIds, type ResourceCost } from "@bibliothecadao/types";

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
export const VILLAGE_MAX_LEVEL = 2;
export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],

  [RealmLevels.City]: [
    { resource: ResourcesIds.Labor, amount: 100_000 },
    { resource: ResourcesIds.Wheat, amount: 1_500_000 },
    { resource: ResourcesIds.Fish, amount: 1_500_000 },
    { resource: ResourcesIds.Wood, amount: 150_000 },
    { resource: ResourcesIds.Stone, amount: 150_000 },
    { resource: ResourcesIds.Coal, amount: 150_000 },
  ],

  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 500_000 },
    { resource: ResourcesIds.Wheat, amount: 3_000_000 },
    { resource: ResourcesIds.Fish, amount: 3_000_000 },
    { resource: ResourcesIds.Copper, amount: 500_000 },
    { resource: ResourcesIds.Obsidian, amount: 500_000 },
    { resource: ResourcesIds.Silver, amount: 500_000 },
    { resource: ResourcesIds.Hartwood, amount: 250_000 },
  ],

  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 1_000_000 },
    { resource: ResourcesIds.Wheat, amount: 9_000_000 },
    { resource: ResourcesIds.Fish, amount: 9_000_000 },
    { resource: ResourcesIds.Hartwood, amount: 1_000_000 },
    { resource: ResourcesIds.Diamonds, amount: 500_000 },
    { resource: ResourcesIds.Sapphire, amount: 500_000 },
    { resource: ResourcesIds.Ruby, amount: 500_000 },
    { resource: ResourcesIds.TrueIce, amount: 100_000 },
    { resource: ResourcesIds.TwilightQuartz, amount: 100_000 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 100_000 },
  ],
};
