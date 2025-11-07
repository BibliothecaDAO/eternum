import { BuildingType, getProducedResource, ResourcesIds, type ResourceInputs } from "@bibliothecadao/types";

export const BUILDING_CAPACITY: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.WorkersHut]: 5,
  [BuildingType.Storehouse]: 0,
  [BuildingType.ResourceStone]: 0,
  [BuildingType.ResourceCoal]: 0,
  [BuildingType.ResourceWood]: 0,
  [BuildingType.ResourceCopper]: 0,
  [BuildingType.ResourceIronwood]: 0,
  [BuildingType.ResourceObsidian]: 0,
  [BuildingType.ResourceGold]: 0,
  [BuildingType.ResourceSilver]: 0,
  [BuildingType.ResourceMithral]: 0,
  [BuildingType.ResourceAlchemicalSilver]: 0,
  [BuildingType.ResourceColdIron]: 0,
  [BuildingType.ResourceDeepCrystal]: 0,
  [BuildingType.ResourceRuby]: 0,
  [BuildingType.ResourceDiamonds]: 0,
  [BuildingType.ResourceHartwood]: 0,
  [BuildingType.ResourceIgnium]: 0,
  [BuildingType.ResourceTwilightQuartz]: 0,
  [BuildingType.ResourceTrueIce]: 0,
  [BuildingType.ResourceAdamantine]: 0,
  [BuildingType.ResourceSapphire]: 0,
  [BuildingType.ResourceEtherealSilica]: 0,
  [BuildingType.ResourceDragonhide]: 0,
  [BuildingType.ResourceLabor]: 0,
  [BuildingType.ResourceAncientFragment]: 0,
  [BuildingType.ResourceDonkey]: 0,
  [BuildingType.ResourceKnightT1]: 0,
  [BuildingType.ResourceKnightT2]: 0,
  [BuildingType.ResourceKnightT3]: 0,
  [BuildingType.ResourceCrossbowmanT1]: 0,
  [BuildingType.ResourceCrossbowmanT2]: 0,
  [BuildingType.ResourceCrossbowmanT3]: 0,
  [BuildingType.ResourcePaladinT1]: 0,
  [BuildingType.ResourcePaladinT2]: 0,
  [BuildingType.ResourcePaladinT3]: 0,
  [BuildingType.ResourceWheat]: 0,
  [BuildingType.ResourceFish]: 0,
};

export const BUILDING_POPULATION: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.Storehouse]: 2,
  [BuildingType.ResourceStone]: 2,
  [BuildingType.ResourceCoal]: 2,
  [BuildingType.ResourceWood]: 2,
  [BuildingType.ResourceCopper]: 2,
  [BuildingType.ResourceIronwood]: 2,
  [BuildingType.ResourceObsidian]: 2,
  [BuildingType.ResourceGold]: 2,
  [BuildingType.ResourceSilver]: 2,
  [BuildingType.ResourceMithral]: 2,
  [BuildingType.ResourceAlchemicalSilver]: 2,
  [BuildingType.ResourceColdIron]: 2,
  [BuildingType.ResourceDeepCrystal]: 2,
  [BuildingType.ResourceRuby]: 2,
  [BuildingType.ResourceDiamonds]: 2,
  [BuildingType.ResourceHartwood]: 2,
  [BuildingType.ResourceIgnium]: 2,
  [BuildingType.ResourceTwilightQuartz]: 2,
  [BuildingType.ResourceTrueIce]: 2,
  [BuildingType.ResourceAdamantine]: 2,
  [BuildingType.ResourceSapphire]: 2,
  [BuildingType.ResourceEtherealSilica]: 2,
  [BuildingType.ResourceDragonhide]: 2,
  [BuildingType.ResourceLabor]: 0,
  [BuildingType.ResourceAncientFragment]: 2,
  [BuildingType.ResourceDonkey]: 3,
  [BuildingType.ResourceKnightT1]: 3,
  [BuildingType.ResourceKnightT2]: 3,
  [BuildingType.ResourceKnightT3]: 3,
  [BuildingType.ResourceCrossbowmanT1]: 3,
  [BuildingType.ResourceCrossbowmanT2]: 3,
  [BuildingType.ResourceCrossbowmanT3]: 3,
  [BuildingType.ResourcePaladinT1]: 3,
  [BuildingType.ResourcePaladinT2]: 3,
  [BuildingType.ResourcePaladinT3]: 3,
  [BuildingType.ResourceWheat]: 1,
  [BuildingType.ResourceFish]: 1,
};

export const BUILDING_RESOURCE_PRODUCED: { [key in BuildingType]: number } = {
  [BuildingType.None]: getProducedResource(BuildingType.None) ?? 0,
  [BuildingType.WorkersHut]: getProducedResource(BuildingType.WorkersHut) ?? 0,
  [BuildingType.Storehouse]: getProducedResource(BuildingType.Storehouse) ?? 0,
  [BuildingType.ResourceStone]: getProducedResource(BuildingType.ResourceStone) ?? 0,
  [BuildingType.ResourceCoal]: getProducedResource(BuildingType.ResourceCoal) ?? 0,
  [BuildingType.ResourceWood]: getProducedResource(BuildingType.ResourceWood) ?? 0,
  [BuildingType.ResourceCopper]: getProducedResource(BuildingType.ResourceCopper) ?? 0,
  [BuildingType.ResourceIronwood]: getProducedResource(BuildingType.ResourceIronwood) ?? 0,
  [BuildingType.ResourceObsidian]: getProducedResource(BuildingType.ResourceObsidian) ?? 0,
  [BuildingType.ResourceGold]: getProducedResource(BuildingType.ResourceGold) ?? 0,
  [BuildingType.ResourceSilver]: getProducedResource(BuildingType.ResourceSilver) ?? 0,
  [BuildingType.ResourceMithral]: getProducedResource(BuildingType.ResourceMithral) ?? 0,
  [BuildingType.ResourceAlchemicalSilver]: getProducedResource(BuildingType.ResourceAlchemicalSilver) ?? 0,
  [BuildingType.ResourceColdIron]: getProducedResource(BuildingType.ResourceColdIron) ?? 0,
  [BuildingType.ResourceDeepCrystal]: getProducedResource(BuildingType.ResourceDeepCrystal) ?? 0,
  [BuildingType.ResourceRuby]: getProducedResource(BuildingType.ResourceRuby) ?? 0,
  [BuildingType.ResourceDiamonds]: getProducedResource(BuildingType.ResourceDiamonds) ?? 0,
  [BuildingType.ResourceHartwood]: getProducedResource(BuildingType.ResourceHartwood) ?? 0,
  [BuildingType.ResourceIgnium]: getProducedResource(BuildingType.ResourceIgnium) ?? 0,
  [BuildingType.ResourceTwilightQuartz]: getProducedResource(BuildingType.ResourceTwilightQuartz) ?? 0,
  [BuildingType.ResourceTrueIce]: getProducedResource(BuildingType.ResourceTrueIce) ?? 0,
  [BuildingType.ResourceAdamantine]: getProducedResource(BuildingType.ResourceAdamantine) ?? 0,
  [BuildingType.ResourceSapphire]: getProducedResource(BuildingType.ResourceSapphire) ?? 0,
  [BuildingType.ResourceEtherealSilica]: getProducedResource(BuildingType.ResourceEtherealSilica) ?? 0,
  [BuildingType.ResourceDragonhide]: getProducedResource(BuildingType.ResourceDragonhide) ?? 0,
  [BuildingType.ResourceLabor]: getProducedResource(BuildingType.ResourceLabor) ?? 0,
  [BuildingType.ResourceAncientFragment]: getProducedResource(BuildingType.ResourceAncientFragment) ?? 0,
  [BuildingType.ResourceDonkey]: getProducedResource(BuildingType.ResourceDonkey) ?? 0,
  [BuildingType.ResourceKnightT1]: getProducedResource(BuildingType.ResourceKnightT1) ?? 0,
  [BuildingType.ResourceKnightT2]: getProducedResource(BuildingType.ResourceKnightT2) ?? 0,
  [BuildingType.ResourceKnightT3]: getProducedResource(BuildingType.ResourceKnightT3) ?? 0,
  [BuildingType.ResourceCrossbowmanT1]: getProducedResource(BuildingType.ResourceCrossbowmanT1) ?? 0,
  [BuildingType.ResourceCrossbowmanT2]: getProducedResource(BuildingType.ResourceCrossbowmanT2) ?? 0,
  [BuildingType.ResourceCrossbowmanT3]: getProducedResource(BuildingType.ResourceCrossbowmanT3) ?? 0,
  [BuildingType.ResourcePaladinT1]: getProducedResource(BuildingType.ResourcePaladinT1) ?? 0,
  [BuildingType.ResourcePaladinT2]: getProducedResource(BuildingType.ResourcePaladinT2) ?? 0,
  [BuildingType.ResourcePaladinT3]: getProducedResource(BuildingType.ResourcePaladinT3) ?? 0,
  [BuildingType.ResourceWheat]: getProducedResource(BuildingType.ResourceWheat) ?? 0,
  [BuildingType.ResourceFish]: getProducedResource(BuildingType.ResourceFish) ?? 0,
};

export const COMPLEX_BUILDING_COSTS: ResourceInputs = {
  [BuildingType.None]: [],
  [BuildingType.ResourceLabor]: [],
  [BuildingType.ResourceAncientFragment]: [],
  // Basic Buildings
  [BuildingType.ResourceWheat]: [{ resource: ResourcesIds.Labor, amount: 30 }], // Farm
  [BuildingType.ResourceFish]: [],
  [BuildingType.ResourceWood]: [{ resource: ResourcesIds.Labor, amount: 30 }], // Wood Mill
  [BuildingType.ResourceStone]: [],
  [BuildingType.ResourceCoal]: [
    { resource: ResourcesIds.Labor, amount: 30 },
    { resource: ResourcesIds.Wood, amount: 30 },
  ], // Coal Mine
  [BuildingType.ResourceCopper]: [
    { resource: ResourcesIds.Labor, amount: 60 },
    { resource: ResourcesIds.Wood, amount: 60 },
    { resource: ResourcesIds.Coal, amount: 30 },
  ], // Copper Smelter
  [BuildingType.ResourceObsidian]: [],
  [BuildingType.ResourceSilver]: [],
  [BuildingType.ResourceIronwood]: [
    { resource: ResourcesIds.Labor, amount: 120 },
    { resource: ResourcesIds.Wood, amount: 90 },
    { resource: ResourcesIds.Coal, amount: 60 },
    { resource: ResourcesIds.Copper, amount: 30 },
  ], // Ironwood Mill
  [BuildingType.ResourceColdIron]: [
    { resource: ResourcesIds.Labor, amount: 120 },
    { resource: ResourcesIds.Wood, amount: 90 },
    { resource: ResourcesIds.Coal, amount: 60 },
    { resource: ResourcesIds.Copper, amount: 30 },
  ], // Cold Iron Foundry
  [BuildingType.ResourceGold]: [
    { resource: ResourcesIds.Labor, amount: 120 },
    { resource: ResourcesIds.Wood, amount: 90 },
    { resource: ResourcesIds.Coal, amount: 60 },
    { resource: ResourcesIds.Copper, amount: 30 },
  ], // Gold Mine
  [BuildingType.ResourceHartwood]: [],
  [BuildingType.ResourceDiamonds]: [],
  [BuildingType.ResourceSapphire]: [],
  [BuildingType.ResourceRuby]: [],
  [BuildingType.ResourceDeepCrystal]: [],
  [BuildingType.ResourceIgnium]: [],
  [BuildingType.ResourceEtherealSilica]: [],
  [BuildingType.ResourceTrueIce]: [],
  [BuildingType.ResourceTwilightQuartz]: [],
  [BuildingType.ResourceAlchemicalSilver]: [],
  [BuildingType.ResourceAdamantine]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 120 },
    { resource: ResourcesIds.Copper, amount: 90 },
    { resource: ResourcesIds.Ironwood, amount: 30 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // Adamantine Mine
  [BuildingType.ResourceMithral]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 120 },
    { resource: ResourcesIds.Copper, amount: 90 },
    { resource: ResourcesIds.ColdIron, amount: 30 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // Mithral Forge
  [BuildingType.ResourceDragonhide]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 120 },
    { resource: ResourcesIds.Copper, amount: 90 },
    { resource: ResourcesIds.Gold, amount: 30 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // Dragonhide Tannery
  // T1 Military Buildings
  [BuildingType.ResourceKnightT1]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
  ], // T1 Barracks
  [BuildingType.ResourceCrossbowmanT1]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
  ], // T1 Archery Range
  [BuildingType.ResourcePaladinT1]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
  ], // T1 Stables
  // T2 Military Buildings
  [BuildingType.ResourceKnightT2]: [
    { resource: ResourcesIds.Labor, amount: 300 },
    { resource: ResourcesIds.Wood, amount: 240 },
    { resource: ResourcesIds.Copper, amount: 180 },
    { resource: ResourcesIds.ColdIron, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // T2 Barracks
  [BuildingType.ResourceCrossbowmanT2]: [
    { resource: ResourcesIds.Labor, amount: 300 },
    { resource: ResourcesIds.Wood, amount: 240 },
    { resource: ResourcesIds.Copper, amount: 180 },
    { resource: ResourcesIds.Ironwood, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // T2 Archery Range
  [BuildingType.ResourcePaladinT2]: [
    { resource: ResourcesIds.Labor, amount: 300 },
    { resource: ResourcesIds.Wood, amount: 240 },
    { resource: ResourcesIds.Copper, amount: 180 },
    { resource: ResourcesIds.Gold, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 500 },
  ], // T2 Stables
  // T3 Military Buildings
  [BuildingType.ResourceKnightT3]: [
    { resource: ResourcesIds.Labor, amount: 420 },
    { resource: ResourcesIds.Wood, amount: 300 },
    { resource: ResourcesIds.ColdIron, amount: 240 },
    { resource: ResourcesIds.Mithral, amount: 90 },
    { resource: ResourcesIds.Essence, amount: 1000 },
  ], // T3 Barracks
  [BuildingType.ResourceCrossbowmanT3]: [
    { resource: ResourcesIds.Labor, amount: 420 },
    { resource: ResourcesIds.Wood, amount: 300 },
    { resource: ResourcesIds.Ironwood, amount: 240 },
    { resource: ResourcesIds.Adamantine, amount: 90 },
    { resource: ResourcesIds.Essence, amount: 1000 },
  ], // T3 Archery Range
  [BuildingType.ResourcePaladinT3]: [
    { resource: ResourcesIds.Labor, amount: 420 },
    { resource: ResourcesIds.Wood, amount: 300 },
    { resource: ResourcesIds.Gold, amount: 240 },
    { resource: ResourcesIds.Dragonhide, amount: 90 },
    { resource: ResourcesIds.Essence, amount: 1000 },
  ], // T3 Stables
  // Economic Buildings
  [BuildingType.WorkersHut]: [
    { resource: ResourcesIds.Labor, amount: 30 },
    { resource: ResourcesIds.Wood, amount: 30 },
  ], // Worker Hut
  [BuildingType.ResourceDonkey]: [
    { resource: ResourcesIds.Labor, amount: 60 },
    { resource: ResourcesIds.Wood, amount: 60 },
  ],
};

export const SIMPLE_BUILDING_COSTS: ResourceInputs = {
  [BuildingType.None]: [],
  [BuildingType.ResourceLabor]: [],
  [BuildingType.ResourceAncientFragment]: [],
  // Basic Buildings
  [BuildingType.ResourceWheat]: [{ resource: ResourcesIds.Labor, amount: 30 }], // Farm
  [BuildingType.ResourceFish]: [],
  [BuildingType.ResourceWood]: [{ resource: ResourcesIds.Labor, amount: 30 }], // Wood Mill
  [BuildingType.ResourceStone]: [],
  [BuildingType.ResourceCoal]: [{ resource: ResourcesIds.Labor, amount: 90 }], // Coal Mine
  [BuildingType.ResourceCopper]: [{ resource: ResourcesIds.Labor, amount: 300 }], // Copper Smelter
  [BuildingType.ResourceObsidian]: [],
  [BuildingType.ResourceSilver]: [],
  [BuildingType.ResourceIronwood]: [{ resource: ResourcesIds.Labor, amount: 600 }], // Ironwood Mill
  [BuildingType.ResourceColdIron]: [{ resource: ResourcesIds.Labor, amount: 600 }], // Cold Iron Foundry
  [BuildingType.ResourceGold]: [{ resource: ResourcesIds.Labor, amount: 600 }], // Gold Mine
  [BuildingType.ResourceHartwood]: [],
  [BuildingType.ResourceDiamonds]: [],
  [BuildingType.ResourceSapphire]: [],
  [BuildingType.ResourceRuby]: [],
  [BuildingType.ResourceDeepCrystal]: [],
  [BuildingType.ResourceIgnium]: [],
  [BuildingType.ResourceEtherealSilica]: [],
  [BuildingType.ResourceTrueIce]: [],
  [BuildingType.ResourceTwilightQuartz]: [],
  [BuildingType.ResourceAlchemicalSilver]: [],
  [BuildingType.ResourceAdamantine]: [],
  [BuildingType.ResourceMithral]: [],
  [BuildingType.ResourceDragonhide]: [],
  // T1 Military Buildings - only available in simple mode
  [BuildingType.ResourceKnightT1]: [{ resource: ResourcesIds.Labor, amount: 1200 }], // T1 Barracks
  [BuildingType.ResourceCrossbowmanT1]: [{ resource: ResourcesIds.Labor, amount: 1200 }], // T1 Archery Range
  [BuildingType.ResourcePaladinT1]: [{ resource: ResourcesIds.Labor, amount: 1200 }], // T1 Stables

  // T2 Military Buildings - not available in simple mode
  [BuildingType.ResourceKnightT2]: [],
  [BuildingType.ResourceCrossbowmanT2]: [],
  [BuildingType.ResourcePaladinT2]: [],

  // T3 Military Buildings - not available in simple mode
  [BuildingType.ResourceKnightT3]: [],
  [BuildingType.ResourceCrossbowmanT3]: [],
  [BuildingType.ResourcePaladinT3]: [],

  // Economic Buildings
  [BuildingType.ResourceDonkey]: [{ resource: ResourcesIds.Labor, amount: 180 }],
  [BuildingType.WorkersHut]: [{ resource: ResourcesIds.Labor, amount: 90 }], // Worker Hut
};
