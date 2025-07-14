import {
  ResourcesIds,
  type ResourceCost,
  type ResourceInputs,
  type ResourceMinMax,
  type ResourceOutputs,
} from "@bibliothecadao/types";

// weight in kg
// grams / 10^9
export const RESOURCES_WEIGHTS_NANOGRAM: { [key in ResourcesIds]: number } = {
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
  [ResourcesIds.Labor]: 1000,
  [ResourcesIds.AncientFragment]: 100, // 0.1 kg
  [ResourcesIds.Essence]: 100, // 0.1 kg
  [ResourcesIds.Donkey]: 0,
  [ResourcesIds.Knight]: 5000,
  [ResourcesIds.KnightT2]: 5000,
  [ResourcesIds.KnightT3]: 5000,
  [ResourcesIds.Crossbowman]: 5000,
  [ResourcesIds.CrossbowmanT2]: 5000,
  [ResourcesIds.CrossbowmanT3]: 5000,
  [ResourcesIds.Paladin]: 5000,
  [ResourcesIds.PaladinT2]: 5000,
  [ResourcesIds.PaladinT3]: 5000,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 100,
  [ResourcesIds.Fish]: 100,
};

export const RESOURCE_PRODUCTION_OUTPUT_AMOUNTS: ResourceOutputs = {
  [ResourcesIds.Wood]: 1,
  [ResourcesIds.Stone]: 1,
  [ResourcesIds.Coal]: 1,
  [ResourcesIds.Copper]: 1,
  [ResourcesIds.Obsidian]: 1,
  [ResourcesIds.Silver]: 1,
  [ResourcesIds.Ironwood]: 1,
  [ResourcesIds.ColdIron]: 1,
  [ResourcesIds.Gold]: 1,
  [ResourcesIds.Hartwood]: 1,
  [ResourcesIds.Diamonds]: 1,
  [ResourcesIds.Sapphire]: 1,
  [ResourcesIds.Ruby]: 1,
  [ResourcesIds.DeepCrystal]: 1,
  [ResourcesIds.Ignium]: 1,
  [ResourcesIds.EtherealSilica]: 1,
  [ResourcesIds.TrueIce]: 1,
  [ResourcesIds.TwilightQuartz]: 1,
  [ResourcesIds.AlchemicalSilver]: 1,
  [ResourcesIds.Adamantine]: 1,
  [ResourcesIds.Mithral]: 1,
  [ResourcesIds.Dragonhide]: 1,
  [ResourcesIds.Donkey]: 0.5,
  [ResourcesIds.Knight]: 0.05,
  [ResourcesIds.KnightT2]: 0.05,
  [ResourcesIds.KnightT3]: 0.05,
  [ResourcesIds.Crossbowman]: 0.05,
  [ResourcesIds.CrossbowmanT2]: 0.05,
  [ResourcesIds.CrossbowmanT3]: 0.05,
  [ResourcesIds.Paladin]: 0.05,
  [ResourcesIds.PaladinT2]: 0.05,
  [ResourcesIds.PaladinT3]: 0.05,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 50,
  [ResourcesIds.Fish]: 50,
  [ResourcesIds.AncientFragment]: 3,
  [ResourcesIds.Essence]: 5,
  [ResourcesIds.Labor]: 30,
};

export const RESOURCE_PRODUCTION_INPUT_RESOURCES: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Coal, amount: 0.2 },
    { resource: ResourcesIds.Copper, amount: 0.2 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Wood, amount: 0.36 },
    { resource: ResourcesIds.Copper, amount: 0.24 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Wood, amount: 0.36 },
    { resource: ResourcesIds.Coal, amount: 0.24 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Coal, amount: 0.48 },
    { resource: ResourcesIds.Copper, amount: 0.32 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Coal, amount: 0.48 },
    { resource: ResourcesIds.Copper, amount: 0.32 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Coal, amount: 0.48 },
    { resource: ResourcesIds.Copper, amount: 0.32 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Coal, amount: 0.72 },
    { resource: ResourcesIds.Ironwood, amount: 0.48 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Coal, amount: 0.72 },
    { resource: ResourcesIds.ColdIron, amount: 0.48 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Coal, amount: 0.72 },
    { resource: ResourcesIds.Gold, amount: 0.48 },
  ],
  // All other resources not in the provided list have empty input arrays
  [ResourcesIds.Stone]: [],
  [ResourcesIds.Obsidian]: [],
  [ResourcesIds.Silver]: [],
  [ResourcesIds.Hartwood]: [],
  [ResourcesIds.Diamonds]: [],
  [ResourcesIds.Sapphire]: [],
  [ResourcesIds.Ruby]: [],
  [ResourcesIds.DeepCrystal]: [],
  [ResourcesIds.Ignium]: [],
  [ResourcesIds.EtherealSilica]: [],
  [ResourcesIds.TrueIce]: [],
  [ResourcesIds.TwilightQuartz]: [],
  [ResourcesIds.AlchemicalSilver]: [],
  [ResourcesIds.Donkey]: [],
  [ResourcesIds.Knight]: [],
  [ResourcesIds.KnightT2]: [],
  [ResourcesIds.KnightT3]: [],
  [ResourcesIds.Crossbowman]: [],
  [ResourcesIds.CrossbowmanT2]: [],
  [ResourcesIds.CrossbowmanT3]: [],
  [ResourcesIds.Paladin]: [],
  [ResourcesIds.PaladinT2]: [],
  [ResourcesIds.PaladinT3]: [],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
  [ResourcesIds.Essence]: [],
  [ResourcesIds.Labor]: [],
};

export const STARTING_RESOURCES: ResourceCost[] = [
  { resource: ResourcesIds.Wheat, amount: 3_000_000 },
  { resource: ResourcesIds.Fish, amount: 3_000_000 },
  { resource: ResourcesIds.Labor, amount: 300_000 },
  { resource: ResourcesIds.Donkey, amount: 3_000 },
  // 5000, tokenized troops . only one troop type will be selected
  { resource: ResourcesIds.Knight, amount: 5_000 },
  { resource: ResourcesIds.Crossbowman, amount: 5_000 },
  { resource: ResourcesIds.Paladin, amount: 5_000 },
];

export const VILLAGE_STARTING_RESOURCES: ResourceCost[] = [
  { resource: ResourcesIds.Wheat, amount: 2_000_000 },
  { resource: ResourcesIds.Fish, amount: 2_000_000 },
  { resource: ResourcesIds.Labor, amount: 200_000 },
  { resource: ResourcesIds.Donkey, amount: 1_500 },
  // 1000, tokenized troops. only one troop type will be selected
  { resource: ResourcesIds.Knight, amount: 1_000 },
  { resource: ResourcesIds.Crossbowman, amount: 1_000 },
  { resource: ResourcesIds.Paladin, amount: 1_000 },
];

export const DISCOVERABLE_VILLAGE_STARTING_RESOURCES: ResourceMinMax[] = [
  { resource: ResourcesIds.Wheat, min_amount: 300, max_amount: 600 },
  { resource: ResourcesIds.Labor, min_amount: 400, max_amount: 800 },
  { resource: ResourcesIds.Donkey, min_amount: 20, max_amount: 50 },
  { resource: ResourcesIds.Knight, min_amount: 100, max_amount: 150 },
];

export const LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES: ResourceOutputs = {
  [ResourcesIds.Wood]: 1,
  [ResourcesIds.Stone]: 1,
  [ResourcesIds.Coal]: 1,
  [ResourcesIds.Copper]: 2,
  [ResourcesIds.Obsidian]: 2,
  [ResourcesIds.Silver]: 3,
  [ResourcesIds.Ironwood]: 4,
  [ResourcesIds.ColdIron]: 5,
  [ResourcesIds.Gold]: 5,
  [ResourcesIds.Hartwood]: 7,
  [ResourcesIds.Diamonds]: 14,
  [ResourcesIds.Sapphire]: 16,
  [ResourcesIds.Ruby]: 16,
  [ResourcesIds.DeepCrystal]: 16,
  [ResourcesIds.Ignium]: 22,
  [ResourcesIds.EtherealSilica]: 23,
  [ResourcesIds.TrueIce]: 26,
  [ResourcesIds.TwilightQuartz]: 32,
  [ResourcesIds.AlchemicalSilver]: 37,
  [ResourcesIds.Adamantine]: 59,
  [ResourcesIds.Mithral]: 84,
  [ResourcesIds.Dragonhide]: 128,
  [ResourcesIds.Donkey]: 0,
  [ResourcesIds.Knight]: 0,
  [ResourcesIds.KnightT2]: 0,
  [ResourcesIds.KnightT3]: 0,
  [ResourcesIds.Crossbowman]: 0,
  [ResourcesIds.CrossbowmanT2]: 0,
  [ResourcesIds.CrossbowmanT3]: 0,
  [ResourcesIds.Paladin]: 0,
  [ResourcesIds.PaladinT2]: 0,
  [ResourcesIds.PaladinT3]: 0,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 0,
  [ResourcesIds.Fish]: 0,
  [ResourcesIds.AncientFragment]: 0,
  [ResourcesIds.Essence]: 0,
  [ResourcesIds.Labor]: 0,
};
export const RESOURCE_PRODUCTION_OUTPUT_AMOUNTS_SIMPLE_SYSTEM: ResourceOutputs = RESOURCE_PRODUCTION_OUTPUT_AMOUNTS;

export const RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Labor, amount: 14 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Stone]: [
    { resource: ResourcesIds.Labor, amount: 14 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Labor, amount: 17.9 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Labor, amount: 21.7 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Obsidian]: [
    { resource: ResourcesIds.Labor, amount: 34.48 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Silver]: [
    { resource: ResourcesIds.Labor, amount: 39.2 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Labor, amount: 53.73 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Labor, amount: 65.28 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.Labor, amount: 84.7 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Hartwood]: [
    { resource: ResourcesIds.Labor, amount: 107.45 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Diamonds]: [
    { resource: ResourcesIds.Labor, amount: 156.28 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Sapphire]: [
    { resource: ResourcesIds.Labor, amount: 231.7 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ruby]: [
    { resource: ResourcesIds.Labor, amount: 249.2 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.DeepCrystal]: [
    { resource: ResourcesIds.Labor, amount: 288.05 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ignium]: [
    { resource: ResourcesIds.Labor, amount: 300.13 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.EtherealSilica]: [
    { resource: ResourcesIds.Labor, amount: 379.05 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.TrueIce]: [
    { resource: ResourcesIds.Labor, amount: 430.15 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.TwilightQuartz]: [
    { resource: ResourcesIds.Labor, amount: 494.38 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.AlchemicalSilver]: [
    { resource: ResourcesIds.Labor, amount: 678.48 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.Labor, amount: 877.8 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Labor, amount: 1448.13 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Labor, amount: 1569.15 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Donkey]: [],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 60 },
  ],
  [ResourcesIds.KnightT2]: [],
  [ResourcesIds.KnightT3]: [],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 60 },
  ],
  [ResourcesIds.CrossbowmanT2]: [],
  [ResourcesIds.CrossbowmanT3]: [],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 60 },
  ],
  [ResourcesIds.PaladinT2]: [],
  [ResourcesIds.PaladinT3]: [],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
  [ResourcesIds.Essence]: [],
  [ResourcesIds.Labor]: [],
};

export const multiplyStartingResources = (multiplier: number): ResourceCost[] => {
  return STARTING_RESOURCES.map((resource) => ({
    resource: resource.resource,
    amount: resource.amount * multiplier,
  }));
};

/**
 * Returns all resources with a specified amount, excluding Lords
 * @param amount The amount to assign to each resource
 * @returns Array of ResourceCost objects for all resources except Lords
 */
export const getAllResourcesWithAmount = (amount: number): ResourceCost[] => {
  // Filter out string keys and only keep numeric resource IDs, excluding Lords
  return Object.values(ResourcesIds)
    .filter((resource): resource is ResourcesIds => typeof resource === "number" && resource !== ResourcesIds.Lords)
    .map((resource) => ({
      resource,
      amount,
    }));
};

export const multiplyVillageStartingResources = (multiplier: number): ResourceCost[] => {
  return VILLAGE_STARTING_RESOURCES.map((resource) => ({
    resource: resource.resource,
    amount: resource.amount * multiplier,
  }));
};
export const RESOURCE_BANDS = {
  T1_TROOPS_PRIMARY: [
    ResourcesIds.Copper,
    ResourcesIds.Obsidian,
    ResourcesIds.Silver,
    ResourcesIds.Ironwood,
    ResourcesIds.ColdIron,
    ResourcesIds.Gold,
  ],
  T2_TROOPS_SECONDARY: [ResourcesIds.Hartwood, ResourcesIds.Diamonds, ResourcesIds.Sapphire, ResourcesIds.Ruby],
  T2_TROOPS_TERTIARY: [ResourcesIds.DeepCrystal, ResourcesIds.Ignium, ResourcesIds.EtherealSilica],
  T3_TROOPS_SECONDARY: [ResourcesIds.TrueIce, ResourcesIds.TwilightQuartz, ResourcesIds.AlchemicalSilver],
  T3_TROOPS_TERTIARY: [ResourcesIds.Adamantine, ResourcesIds.Mithral, ResourcesIds.Dragonhide],
};

export const RESOURCE_TO_BAND: { [key in ResourcesIds]?: string } = {};

Object.entries(RESOURCE_BANDS).forEach(([bandName, resources]) => {
  (resources as ResourcesIds[]).forEach((resourceId) => {
    RESOURCE_TO_BAND[resourceId] = bandName;
  });
});
