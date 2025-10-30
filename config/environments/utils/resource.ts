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
  [ResourcesIds.Donkey]: 0.1,
  [ResourcesIds.Knight]: 5,
  [ResourcesIds.KnightT2]: 5,
  [ResourcesIds.KnightT3]: 5,
  [ResourcesIds.Crossbowman]: 5,
  [ResourcesIds.CrossbowmanT2]: 5,
  [ResourcesIds.CrossbowmanT3]: 5,
  [ResourcesIds.Paladin]: 5,
  [ResourcesIds.PaladinT2]: 5,
  [ResourcesIds.PaladinT3]: 5,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 5,
  [ResourcesIds.Fish]: 0,
  [ResourcesIds.AncientFragment]: 3,
  [ResourcesIds.Essence]: 5,
  [ResourcesIds.Labor]: 1,
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
    { resource: ResourcesIds.Wheat, amount: 3 },
    { resource: ResourcesIds.Coal, amount: 0.6 },
    { resource: ResourcesIds.Ironwood, amount: 0.4 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Wheat, amount: 3 },
    { resource: ResourcesIds.Coal, amount: 0.6 },
    { resource: ResourcesIds.ColdIron, amount: 0.4 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Wheat, amount: 3 },
    { resource: ResourcesIds.Coal, amount: 0.6 },
    { resource: ResourcesIds.Gold, amount: 0.4 },
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
  [ResourcesIds.Donkey]: [{ resource: ResourcesIds.Wheat, amount: 3 }],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Copper, amount: 0.4 },
  ],
  [ResourcesIds.KnightT2]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Knight, amount: 10 },
    { resource: ResourcesIds.Copper, amount: 0.2 },
    { resource: ResourcesIds.ColdIron, amount: 0.4 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ],
  [ResourcesIds.KnightT3]: [
    { resource: ResourcesIds.Wheat, amount: 7 },
    { resource: ResourcesIds.KnightT2, amount: 10 },
    { resource: ResourcesIds.ColdIron, amount: 0.2 },
    { resource: ResourcesIds.Mithral, amount: 0.6 },
    { resource: ResourcesIds.Essence, amount: 3 },
  ],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Copper, amount: 0.4 },
  ],
  [ResourcesIds.CrossbowmanT2]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Crossbowman, amount: 10 },
    { resource: ResourcesIds.Copper, amount: 0.2 },
    { resource: ResourcesIds.Ironwood, amount: 0.4 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ],
  [ResourcesIds.CrossbowmanT3]: [
    { resource: ResourcesIds.Wheat, amount: 7 },
    { resource: ResourcesIds.CrossbowmanT2, amount: 10 },
    { resource: ResourcesIds.Ironwood, amount: 0.2 },
    { resource: ResourcesIds.Adamantine, amount: 0.6 },
    { resource: ResourcesIds.Essence, amount: 3 },
  ],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Copper, amount: 0.4 },
  ],
  [ResourcesIds.PaladinT2]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Paladin, amount: 10 },
    { resource: ResourcesIds.Copper, amount: 0.2 },
    { resource: ResourcesIds.Gold, amount: 0.4 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ],
  [ResourcesIds.PaladinT3]: [
    { resource: ResourcesIds.Wheat, amount: 7 },
    { resource: ResourcesIds.PaladinT2, amount: 10 },
    { resource: ResourcesIds.Gold, amount: 0.2 },
    { resource: ResourcesIds.Dragonhide, amount: 0.6 },
    { resource: ResourcesIds.Essence, amount: 3 },
  ],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
  [ResourcesIds.Essence]: [],
  [ResourcesIds.Labor]: [],
};

export const STARTING_RESOURCES: ResourceCost[] = [
  { resource: ResourcesIds.Wheat, amount: 1_000 },
  { resource: ResourcesIds.Labor, amount: 1_000 },
  { resource: ResourcesIds.Wood, amount: 180 },
  { resource: ResourcesIds.Coal, amount: 120 },
  { resource: ResourcesIds.Copper, amount: 60 },
  { resource: ResourcesIds.Donkey, amount: 200 },
  // 3,000, tokenized troops. Only one troop type will be selected
  { resource: ResourcesIds.Knight, amount: 3_000 },
  { resource: ResourcesIds.Crossbowman, amount: 3_000 },
  { resource: ResourcesIds.Paladin, amount: 3_000 },
];

export const VILLAGE_STARTING_RESOURCES: ResourceCost[] = [
  // { resource: ResourcesIds.Wheat, amount: 2_000_000 },
  // { resource: ResourcesIds.Fish, amount: 2_000_000 },
  // { resource: ResourcesIds.Labor, amount: 200_000 },
  // { resource: ResourcesIds.Donkey, amount: 1_500 },
  // // 1000, tokenized troops. only one troop type will be selected
  // { resource: ResourcesIds.Knight, amount: 1_000 },
  // { resource: ResourcesIds.Crossbowman, amount: 1_000 },
  // { resource: ResourcesIds.Paladin, amount: 1_000 },
];

export const DISCOVERABLE_VILLAGE_STARTING_RESOURCES: ResourceMinMax[] = [
  { resource: ResourcesIds.Labor, min_amount: 5_000, max_amount: 5_000 },
  { resource: ResourcesIds.Donkey, min_amount: 200, max_amount: 200 },
];

export const LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES: ResourceOutputs = {
  [ResourcesIds.Wood]: 0,
  [ResourcesIds.Stone]: 0,
  [ResourcesIds.Coal]: 0,
  [ResourcesIds.Copper]: 0,
  [ResourcesIds.Obsidian]: 0,
  [ResourcesIds.Silver]: 0,
  [ResourcesIds.Ironwood]: 0,
  [ResourcesIds.ColdIron]: 0,
  [ResourcesIds.Gold]: 0,
  [ResourcesIds.Hartwood]: 0,
  [ResourcesIds.Diamonds]: 0,
  [ResourcesIds.Sapphire]: 0,
  [ResourcesIds.Ruby]: 0,
  [ResourcesIds.DeepCrystal]: 0,
  [ResourcesIds.Ignium]: 0,
  [ResourcesIds.EtherealSilica]: 0,
  [ResourcesIds.TrueIce]: 0,
  [ResourcesIds.TwilightQuartz]: 0,
  [ResourcesIds.AlchemicalSilver]: 0,
  [ResourcesIds.Adamantine]: 0,
  [ResourcesIds.Mithral]: 0,
  [ResourcesIds.Dragonhide]: 0,
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
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Labor, amount: 0.5 },
  ],
  [ResourcesIds.Stone]: [],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Labor, amount: 1 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Labor, amount: 1 },
  ],
  [ResourcesIds.Obsidian]: [],
  [ResourcesIds.Silver]: [],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 2.5 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 2.5 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 2.5 },
  ],
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
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Labor, amount: 10 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Labor, amount: 10 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: ResourcesIds.Labor, amount: 10 },
  ],
  [ResourcesIds.Donkey]: [],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 0.5 },
  ],
  [ResourcesIds.KnightT2]: [],
  [ResourcesIds.KnightT3]: [],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 0.5 },
  ],
  [ResourcesIds.CrossbowmanT2]: [],
  [ResourcesIds.CrossbowmanT3]: [],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Labor, amount: 0.5 },
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
