import { ResourcesIds } from "@bibliothecadao/types";

export const LORDS_LIQUIDITY_PER_RESOURCE = 1_000;

export const AMM_STARTING_LIQUIDITY: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 500_000,
  [ResourcesIds.Stone]: 500_000,
  [ResourcesIds.Coal]: 500_000,
  [ResourcesIds.Copper]: 500_000,
  [ResourcesIds.Obsidian]: 500_000,
  [ResourcesIds.Silver]: 500_000,
  [ResourcesIds.Ironwood]: 200_000,
  [ResourcesIds.ColdIron]: 200_000,
  [ResourcesIds.Gold]: 200_000,
  [ResourcesIds.Hartwood]: 200_000,
  [ResourcesIds.Diamonds]: 100_000,
  [ResourcesIds.Sapphire]: 100_000,
  [ResourcesIds.Ruby]: 100_000,
  [ResourcesIds.DeepCrystal]: 75_000,
  [ResourcesIds.Ignium]: 75_000,
  [ResourcesIds.EtherealSilica]: 50_000,
  [ResourcesIds.TrueIce]: 50_000,
  [ResourcesIds.TwilightQuartz]: 50_000,
  [ResourcesIds.AlchemicalSilver]: 50_000,
  [ResourcesIds.Adamantine]: 50_000,
  [ResourcesIds.Mithral]: 50_000,
  [ResourcesIds.Dragonhide]: 50_000,

  [ResourcesIds.Donkey]: 10_000,
};
