import { ResourcesIds } from "@bibliothecadao/types";

export const LORDS_LIQUIDITY_PER_RESOURCE = 2_000;

export const AMM_STARTING_LIQUIDITY: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 2_000_000,
  [ResourcesIds.Stone]: 1_600_000,
  [ResourcesIds.Coal]: 1_600_000,
  [ResourcesIds.Copper]: 1_200_000,
  [ResourcesIds.Obsidian]: 1_000_000,
  [ResourcesIds.Silver]: 800_000,
  [ResourcesIds.Ironwood]: 600_000,
  [ResourcesIds.ColdIron]: 500_000,
  [ResourcesIds.Gold]: 400_000,
  [ResourcesIds.Hartwood]: 300_000,
  [ResourcesIds.Diamonds]: 160_000,
  [ResourcesIds.Sapphire]: 140_000,
  [ResourcesIds.Ruby]: 140_000,
  [ResourcesIds.DeepCrystal]: 120_000,
  [ResourcesIds.Ignium]: 120_000,
  [ResourcesIds.EtherealSilica]: 120_000,
  [ResourcesIds.TrueIce]: 80_000,
  [ResourcesIds.TwilightQuartz]: 80_000,
  [ResourcesIds.AlchemicalSilver]: 80_000,
  [ResourcesIds.Adamantine]: 50_000,
  [ResourcesIds.Mithral]: 40_000,
  [ResourcesIds.Dragonhide]: 30_000,

  [ResourcesIds.Wheat]: 20_000_000,
  [ResourcesIds.Fish]: 20_000_000,

  [ResourcesIds.Donkey]: 120_000,
};
