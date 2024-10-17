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

// Weight that determines the amount of resources needed to finish the hyperstructure
export const HYPERSTRUCTURE_RESOURCE_MULTIPLIERS: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Stone]: 1.27,
  [ResourcesIds.Coal]: 1.31,
  [ResourcesIds.Wood]: 1.0,
  [ResourcesIds.Copper]: 1.9,
  [ResourcesIds.Ironwood]: 4.25,
  [ResourcesIds.Obsidian]: 2.26,
  [ResourcesIds.Gold]: 5.49,
  [ResourcesIds.Silver]: 2.88,
  [ResourcesIds.Mithral]: 135.53,
  [ResourcesIds.AlchemicalSilver]: 53.92,
  [ResourcesIds.ColdIron]: 5.24,
  [ResourcesIds.DeepCrystal]: 20.98,
  [ResourcesIds.Ruby]: 20.98,
  [ResourcesIds.Diamonds]: 16.72,
  [ResourcesIds.Hartwood]: 8.44,
  [ResourcesIds.Ignium]: 29.15,
  [ResourcesIds.TwilightQuartz]: 45.18,
  [ResourcesIds.TrueIce]: 36.06,
  [ResourcesIds.Adamantine]: 91.2,
  [ResourcesIds.Sapphire]: 20.3,
  [ResourcesIds.EtherealSilica]: 30.95,
  [ResourcesIds.Dragonhide]: 217.92,
  [ResourcesIds.AncientFragment]: 20.98,
};
