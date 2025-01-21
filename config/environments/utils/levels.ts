import { RealmLevels, ResourcesIds, type ResourceCost } from "@bibliothecadao/eternum";

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],

  [RealmLevels.City]: [
    { resource: ResourcesIds.Wheat, amount: 3_000_000 },
    { resource: ResourcesIds.Fish, amount: 3_000_000 },
  ],

  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.ColdIron, amount: 600_000 },
    { resource: ResourcesIds.Hartwood, amount: 600_000 },
    { resource: ResourcesIds.Diamonds, amount: 600_000 },
    { resource: ResourcesIds.Sapphire, amount: 600_000 },
    { resource: ResourcesIds.DeepCrystal, amount: 600_000 },
    { resource: ResourcesIds.Wheat, amount: 5_000_000 },
    { resource: ResourcesIds.Fish, amount: 5_000_000 },
  ],

  [RealmLevels.Empire]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 50_000 },
    { resource: ResourcesIds.Adamantine, amount: 50_000 },
    { resource: ResourcesIds.Mithral, amount: 50_000 },
    { resource: ResourcesIds.Dragonhide, amount: 50_000 },
    { resource: ResourcesIds.Wheat, amount: 9_000_000 },
    { resource: ResourcesIds.Fish, amount: 9_000_000 },
  ],
};
