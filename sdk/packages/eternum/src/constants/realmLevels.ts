import { ResourcesIds } from ".";
import { ResourceCost } from "../types";

export enum RealmLevels {
  Settlement,
  City,
  Kingdom,
  Empire,
}

export enum RealmLevelNames {
  Settlement = "Settlement",
  City = "City",
  Kingdom = "Kingdom",
  Empire = "Empire",
}

export const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;

export const REALM_UPGRADE_COSTS: { [key in RealmLevels]: ResourceCost[] } = {
  [RealmLevels.Settlement]: [],

  [RealmLevels.City]: [
    { resource: ResourcesIds.Wheat, amount: 3000 },
    { resource: ResourcesIds.Fish, amount: 3000 },
  ],

  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.ColdIron, amount: 600 },
    { resource: ResourcesIds.Hartwood, amount: 600 },
    { resource: ResourcesIds.Diamonds, amount: 600 },
    { resource: ResourcesIds.Sapphire, amount: 600 },
    { resource: ResourcesIds.DeepCrystal, amount: 600 },
    { resource: ResourcesIds.Wheat, amount: 5000 },
    { resource: ResourcesIds.Fish, amount: 5000 },
  ],

  [RealmLevels.Empire]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 50 },
    { resource: ResourcesIds.Adamantine, amount: 50 },
    { resource: ResourcesIds.Mithral, amount: 50 },
    { resource: ResourcesIds.Dragonhide, amount: 50 },
    { resource: ResourcesIds.Wheat, amount: 9000 },
    { resource: ResourcesIds.Fish, amount: 9000 },
  ],
};

export const LEVEL_DESCRIPTIONS = {
  [RealmLevels.Settlement]: "A small settlement with a few buildings. You have 6 buildable hexes.",
  [RealmLevels.City]: "You will have 18 buildable hexes, and a glorious city with many districts.",
  [RealmLevels.Kingdom]: "You  will have 36 buildable hexes, and a kingdom with many cities and towns.",
  [RealmLevels.Empire]: "You will have 60 buildable hexes, and a vast empire with many kingdoms and cities.",
};
