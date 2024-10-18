import { ResourcesIds } from ".";
import { ResourceCost } from "../types";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCost[] = [
  {
    resource: ResourcesIds.AncientFragment,
    amount: 1000,
  },
];

export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCost[] = [
  { resource: ResourcesIds.Wood, amount: 2000 },
  { resource: ResourcesIds.Stone, amount: 2000 },
  { resource: ResourcesIds.Coal, amount: 2000 },
  { resource: ResourcesIds.Copper, amount: 1000 },
  { resource: ResourcesIds.Obsidian, amount: 1000 },
  { resource: ResourcesIds.Silver, amount: 1000 },
  { resource: ResourcesIds.Ironwood, amount: 1000 },
  { resource: ResourcesIds.ColdIron, amount: 700 },
  { resource: ResourcesIds.Gold, amount: 700 },
  { resource: ResourcesIds.Hartwood, amount: 700 },
  { resource: ResourcesIds.Diamonds, amount: 700 },
  { resource: ResourcesIds.Sapphire, amount: 700 },
  { resource: ResourcesIds.Ruby, amount: 500 },
  { resource: ResourcesIds.DeepCrystal, amount: 500 },
  { resource: ResourcesIds.Ignium, amount: 300 },
  { resource: ResourcesIds.EtherealSilica, amount: 300 },
  { resource: ResourcesIds.TrueIce, amount: 300 },
  { resource: ResourcesIds.TwilightQuartz, amount: 300 },
  { resource: ResourcesIds.AlchemicalSilver, amount: 300 },
  { resource: ResourcesIds.Adamantine, amount: 300 },
  { resource: ResourcesIds.Mithral, amount: 300 },
  { resource: ResourcesIds.Dragonhide, amount: 300 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCost[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
