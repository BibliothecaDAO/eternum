import { ResourcesIds } from ".";

export const HYPERSTRUCTURE_CREATION_COSTS: { resource: number; amount: number }[] = [
  {
    resource: ResourcesIds.Earthenshard,
    amount: 1000,
  },
];

export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: { resource: number; amount: number }[] = [
  { resource: ResourcesIds.Wood, amount: 500 },
  { resource: ResourcesIds.Stone, amount: 500 },
  { resource: ResourcesIds.Coal, amount: 500 },
  { resource: ResourcesIds.Copper, amount: 300 },
  { resource: ResourcesIds.Obsidian, amount: 300 },
  { resource: ResourcesIds.Silver, amount: 300 },
  { resource: ResourcesIds.Ironwood, amount: 300 },
  { resource: ResourcesIds.ColdIron, amount: 150 },
  { resource: ResourcesIds.Gold, amount: 150 },
  { resource: ResourcesIds.Hartwood, amount: 150 },
  { resource: ResourcesIds.Diamonds, amount: 150 },
  { resource: ResourcesIds.Sapphire, amount: 150 },
  { resource: ResourcesIds.Ruby, amount: 150 },
  { resource: ResourcesIds.DeepCrystal, amount: 150 },
  { resource: ResourcesIds.Ignium, amount: 150 },
  { resource: ResourcesIds.EtherealSilica, amount: 150 },
  { resource: ResourcesIds.TrueIce, amount: 150 },
  { resource: ResourcesIds.TwilightQuartz, amount: 150 },
  { resource: ResourcesIds.AlchemicalSilver, amount: 150 },
  { resource: ResourcesIds.Adamantine, amount: 150 },
  { resource: ResourcesIds.Mithral, amount: 150 },
  { resource: ResourcesIds.Dragonhide, amount: 150 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: { resource: number; amount: number }[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];

// Weight that determines the amount of resources needed to finish the hyperstructure
export const HYPERSTRUCTURE_RESOURCE_MULTIPLIERS: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 1.0,
  [ResourcesIds.Stone]: 1.27,
  [ResourcesIds.Coal]: 1.31,
  [ResourcesIds.Copper]: 1.9,
  [ResourcesIds.Obsidian]: 2.26,
  [ResourcesIds.Silver]: 2.88,
  [ResourcesIds.Ironwood]: 4.25,
  [ResourcesIds.ColdIron]: 5.24,
  [ResourcesIds.Gold]: 5.49,
  [ResourcesIds.Hartwood]: 8.44,
  [ResourcesIds.Diamonds]: 16.72,
  [ResourcesIds.Sapphire]: 20.3,
  [ResourcesIds.Ruby]: 20.98,
  [ResourcesIds.DeepCrystal]: 20.98,
  [ResourcesIds.Ignium]: 29.15,
  [ResourcesIds.EtherealSilica]: 30.95,
  [ResourcesIds.TrueIce]: 36.06,
  [ResourcesIds.TwilightQuartz]: 45.18,
  [ResourcesIds.AlchemicalSilver]: 53.92,
  [ResourcesIds.Adamantine]: 91.2,
  [ResourcesIds.Mithral]: 135.53,
  [ResourcesIds.Dragonhide]: 217.92,
  [ResourcesIds.Earthenshard]: 20.98,
};
