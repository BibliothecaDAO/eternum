import { BuildingType, ResourcesIds, type ResourceInputs } from "@bibliothecadao/eternum";

export const BUILDING_CAPACITY: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.Castle]: 5,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: 0,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: 0,
  [BuildingType.FishingVillage]: 0,
  [BuildingType.Barracks1]: 0,
  [BuildingType.Barracks2]: 0,
  [BuildingType.Barracks3]: 0,
  [BuildingType.Market]: 0,
  [BuildingType.ArcheryRange1]: 0,
  [BuildingType.ArcheryRange2]: 0,
  [BuildingType.ArcheryRange3]: 0,
  [BuildingType.Stable1]: 0,
  [BuildingType.Stable2]: 0,
  [BuildingType.Stable3]: 0,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 5,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const BUILDING_POPULATION: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.Castle]: 0,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: 0,
  [BuildingType.Resource]: 2,
  [BuildingType.Farm]: 1,
  [BuildingType.FishingVillage]: 1,
  [BuildingType.Barracks1]: 2,
  [BuildingType.Barracks2]: 2,
  [BuildingType.Barracks3]: 2,
  [BuildingType.Market]: 3,
  [BuildingType.ArcheryRange1]: 2,
  [BuildingType.ArcheryRange2]: 2,
  [BuildingType.ArcheryRange3]: 2,
  [BuildingType.Stable1]: 3,
  [BuildingType.Stable2]: 3,
  [BuildingType.Stable3]: 3,
  [BuildingType.TradingPost]: 2,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 2,
  [BuildingType.Walls]: 2,
  [BuildingType.Storehouse]: 2,
};

export const BUILDING_RESOURCE_PRODUCED: { [key in BuildingType]: number } = {
  [BuildingType.None]: 0,
  [BuildingType.Castle]: ResourcesIds.Labor,
  [BuildingType.Bank]: 0,
  [BuildingType.FragmentMine]: ResourcesIds.AncientFragment,
  [BuildingType.Resource]: 0,
  [BuildingType.Farm]: ResourcesIds.Wheat,
  [BuildingType.FishingVillage]: ResourcesIds.Fish,
  [BuildingType.Barracks1]: ResourcesIds.Knight,
  [BuildingType.Barracks2]: ResourcesIds.KnightT2,
  [BuildingType.Barracks3]: ResourcesIds.KnightT3,
  [BuildingType.Market]: ResourcesIds.Donkey,
  [BuildingType.ArcheryRange1]: ResourcesIds.Crossbowman,
  [BuildingType.ArcheryRange2]: ResourcesIds.CrossbowmanT2,
  [BuildingType.ArcheryRange3]: ResourcesIds.CrossbowmanT3,
  [BuildingType.Stable1]: ResourcesIds.Paladin,
  [BuildingType.Stable2]: ResourcesIds.PaladinT2,
  [BuildingType.Stable3]: ResourcesIds.PaladinT3,
  [BuildingType.TradingPost]: 0,
  [BuildingType.WorkersHut]: 0,
  [BuildingType.WatchTower]: 0,
  [BuildingType.Walls]: 0,
  [BuildingType.Storehouse]: 0,
};

export const OTHER_BUILDING_COSTS: ResourceInputs = {
  [BuildingType.None]: [],
  [BuildingType.Castle]: [],
  [BuildingType.Bank]: [],
  [BuildingType.FragmentMine]: [],
  [BuildingType.Resource]: [], // resource building costs are handled in `RESOURCE_BUILDING_COSTS`
  
  // Basic Buildings - primarily Common resources
  [BuildingType.Farm]: [
    { resource: ResourcesIds.Wood, amount: 500_000 },
    { resource: ResourcesIds.Stone, amount: 300_000 },
    { resource: ResourcesIds.Coal, amount: 200_000 }
  ],
  [BuildingType.FishingVillage]: [
    { resource: ResourcesIds.Wood, amount: 500_000 },
    { resource: ResourcesIds.Stone, amount: 300_000 },
    { resource: ResourcesIds.Coal, amount: 200_000 }
  ],
  [BuildingType.WorkersHut]: [
    { resource: ResourcesIds.Wood, amount: 400_000 },
    { resource: ResourcesIds.Stone, amount: 250_000 },
    { resource: ResourcesIds.Coal, amount: 150_000 }
  ],

  // T1 Military Buildings - primarily Uncommon resources
  [BuildingType.Barracks1]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.ColdIron, amount: 75_000 },
    { resource: ResourcesIds.Wood, amount: 50_000 }
  ],
  [BuildingType.ArcheryRange1]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Hartwood, amount: 100_000 },
    { resource: ResourcesIds.Obsidian, amount: 75_000 },
    { resource: ResourcesIds.Wood, amount: 50_000 }
  ],
  [BuildingType.Stable1]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.Ironwood, amount: 75_000 },
    { resource: ResourcesIds.Wood, amount: 50_000 }
  ],

  // T2 Military Buildings - include Rare resources
  [BuildingType.Barracks2]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.ColdIron, amount: 75_000 },
    { resource: ResourcesIds.Gold, amount: 50_000 },
    { resource: ResourcesIds.Diamonds, amount: 25_000 }
  ],
  [BuildingType.ArcheryRange2]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Hartwood, amount: 100_000 },
    { resource: ResourcesIds.Obsidian, amount: 75_000 },
    { resource: ResourcesIds.Diamonds, amount: 50_000 },
    { resource: ResourcesIds.Ruby, amount: 25_000 }
  ],
  [BuildingType.Stable2]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.Ironwood, amount: 75_000 },
    { resource: ResourcesIds.Gold, amount: 50_000 },
    { resource: ResourcesIds.Diamonds, amount: 25_000 }
  ],

  // T3 Military Buildings - include Epic and Legendary resources
  [BuildingType.Barracks3]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.ColdIron, amount: 75_000 },
    { resource: ResourcesIds.Gold, amount: 50_000 },
    { resource: ResourcesIds.Adamantine, amount: 25_000 },
    { resource: ResourcesIds.TrueIce, amount: 15_000 }
  ],
  [BuildingType.ArcheryRange3]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Hartwood, amount: 100_000 },
    { resource: ResourcesIds.Obsidian, amount: 75_000 },
    { resource: ResourcesIds.Diamonds, amount: 50_000 },
    { resource: ResourcesIds.DeepCrystal, amount: 25_000 },
    { resource: ResourcesIds.TwilightQuartz, amount: 15_000 }
  ],
  [BuildingType.Stable3]: [
    { resource: ResourcesIds.Copper, amount: 800_000 },
    { resource: ResourcesIds.Silver, amount: 100_000 },
    { resource: ResourcesIds.Ironwood, amount: 75_000 },
    { resource: ResourcesIds.Gold, amount: 50_000 },
    { resource: ResourcesIds.Mithral, amount: 25_000 },
    { resource: ResourcesIds.Dragonhide, amount: 15_000 }
  ],

  // Specialist Buildings - mix of resources across tiers
  [BuildingType.Market]: [
    { resource: ResourcesIds.Wood, amount: 500_000 },
    { resource: ResourcesIds.Stone, amount: 300_000 },
    { resource: ResourcesIds.Hartwood, amount: 100_000 },
    { resource: ResourcesIds.Diamonds, amount: 50_000 },
    { resource: ResourcesIds.DeepCrystal, amount: 25_000 }
  ],
  [BuildingType.TradingPost]: [
    { resource: ResourcesIds.Wood, amount: 400_000 },
    { resource: ResourcesIds.Stone, amount: 250_000 },
    { resource: ResourcesIds.Hartwood, amount: 75_000 },
    { resource: ResourcesIds.Diamonds, amount: 35_000 }
  ],
  [BuildingType.WatchTower]: [
    { resource: ResourcesIds.Wood, amount: 300_000 },
    { resource: ResourcesIds.Stone, amount: 200_000 },
    { resource: ResourcesIds.Coal, amount: 100_000 }
  ],
  [BuildingType.Walls]: [
    { resource: ResourcesIds.Stone, amount: 600_000 },
    { resource: ResourcesIds.Wood, amount: 400_000 },
    { resource: ResourcesIds.Coal, amount: 200_000 }
  ],
  [BuildingType.Storehouse]: [
    { resource: ResourcesIds.Wood, amount: 500_000 },
    { resource: ResourcesIds.Stone, amount: 300_000 },
    { resource: ResourcesIds.Hartwood, amount: 100_000 },
    { resource: ResourcesIds.Sapphire, amount: 25_000 }
  ],
};

//  Note: ensure that no resource associated with some other building
//      is also associated with a resource building cost
//      (e.g. dont add Labor resource here again because it is
//      already associated with the Labor building)
export const RESOURCE_BUILDING_COSTS: ResourceInputs = {
  [ResourcesIds.Wood]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Stone]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Coal]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Copper]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Obsidian]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Silver]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Ironwood]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.ColdIron]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Gold]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Hartwood]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Diamonds]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Sapphire]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Ruby]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.DeepCrystal]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Ignium]: [{ resource: ResourcesIds.Wheat, amount: 750 }],
  [ResourcesIds.EtherealSilica]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.TrueIce]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.TwilightQuartz]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.AlchemicalSilver]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Adamantine]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
  [ResourcesIds.Mithral]: [{ resource: ResourcesIds.Wheat, amount: 750_000 }],
  [ResourcesIds.Dragonhide]: [{ resource: ResourcesIds.Fish, amount: 750_000 }],
};
