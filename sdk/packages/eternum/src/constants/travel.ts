import { ResourcesIds } from "./resources";

// 100000 gr per donkey
export const CAPACITY_PER_DONKEY = 100000;

export const DONKEYS_PER_CITY = 10;
export const WEIGHT_PER_DONKEY_KG = 100;

// 10km/h
export const SPEED_PER_DONKEY = 10;

export const ROAD_COST_PER_USAGE = [
  { resourceId: 1, amount: 10000 },
  { resourceId: 2, amount: 10000 },
  { resourceId: 254, amount: 10000 },
  { resourceId: 255, amount: 10000 },
];

export const WeightConfig = {
  [ResourcesIds.Wood]: 1000,
  [ResourcesIds.Stone]: 1000,
  [ResourcesIds.Coal]: 1000,
  [ResourcesIds.Copper]: 1000,
  [ResourcesIds.Obsidian]: 1000,
  [ResourcesIds.Silver]: 1000,
  [ResourcesIds.Ironwood]: 1000,
  [ResourcesIds.ColdIron]: 1000,
  [ResourcesIds.Gold]: 1000,
  [ResourcesIds.Hartwood]: 1000,
  [ResourcesIds.Diamonds]: 1000,
  [ResourcesIds.Sapphire]: 1000,
  [ResourcesIds.Ruby]: 1000,
  [ResourcesIds.DeepCrystal]: 1000,
  [ResourcesIds.Ignium]: 1000,
  [ResourcesIds.EtherealSilica]: 1000,
  [ResourcesIds.TrueIce]: 1000,
  [ResourcesIds.TwilightQuartz]: 1000,
  [ResourcesIds.AlchemicalSilver]: 1000,
  [ResourcesIds.Adamantine]: 1000,
  [ResourcesIds.Mithral]: 1000,
  [ResourcesIds.Dragonhide]: 1000,
  [ResourcesIds.Donkey]: 1000,
  [ResourcesIds.Knight]: 1000,
  [ResourcesIds.Crossbowmen]: 1000,
  [ResourcesIds.Paladin]: 1000,
  [ResourcesIds.Wheat]: 100,
  [ResourcesIds.Fish]: 100,
  [ResourcesIds.Lords]: 1,
  [ResourcesIds.Earthenshard]: 10000,
};
