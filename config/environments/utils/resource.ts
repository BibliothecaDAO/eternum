import { ResourcesIds, type ResourceCost, type ResourceInputs, type ResourceOutputs } from "@bibliothecadao/types";

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
  [ResourcesIds.Wood]: 30,
  [ResourcesIds.Stone]: 30,
  [ResourcesIds.Coal]: 30,
  [ResourcesIds.Copper]: 30,
  [ResourcesIds.Obsidian]: 30,
  [ResourcesIds.Silver]: 30,
  [ResourcesIds.Ironwood]: 30,
  [ResourcesIds.ColdIron]: 30,
  [ResourcesIds.Gold]: 30,
  [ResourcesIds.Hartwood]: 30,
  [ResourcesIds.Diamonds]: 30,
  [ResourcesIds.Sapphire]: 30,
  [ResourcesIds.Ruby]: 30,
  [ResourcesIds.DeepCrystal]: 30,
  [ResourcesIds.Ignium]: 30,
  [ResourcesIds.EtherealSilica]: 30,
  [ResourcesIds.TrueIce]: 30,
  [ResourcesIds.TwilightQuartz]: 30,
  [ResourcesIds.AlchemicalSilver]: 30,
  [ResourcesIds.Adamantine]: 30,
  [ResourcesIds.Mithral]: 30,
  [ResourcesIds.Dragonhide]: 30,
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
  [ResourcesIds.Labor]: 30,
};

export const RESOURCE_PRODUCTION_INPUT_RESOURCES: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Stone, amount: 4.1 },
    { resource: ResourcesIds.Coal, amount: 3.9 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Stone]: [
    { resource: ResourcesIds.Wood, amount: 4.6 },
    { resource: ResourcesIds.Coal, amount: 3.4 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Stone, amount: 4.8 },
    { resource: ResourcesIds.Copper, amount: 3.2 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Coal, amount: 5.2 },
    { resource: ResourcesIds.Obsidian, amount: 3 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Obsidian]: [
    { resource: ResourcesIds.Copper, amount: 4.9 },
    { resource: ResourcesIds.Silver, amount: 3.3 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Silver]: [
    { resource: ResourcesIds.Obsidian, amount: 5.4 },
    { resource: ResourcesIds.Ironwood, amount: 2.9 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Silver, amount: 5.4 },
    { resource: ResourcesIds.ColdIron, amount: 2.9 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Ironwood, amount: 4.7 },
    { resource: ResourcesIds.Gold, amount: 3.7 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.ColdIron, amount: 5.2 },
    { resource: ResourcesIds.Hartwood, amount: 3.2 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Hartwood]: [
    { resource: ResourcesIds.Gold, amount: 6.4 },
    { resource: ResourcesIds.Diamonds, amount: 2.1 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Diamonds]: [
    { resource: ResourcesIds.Hartwood, amount: 6.3 },
    { resource: ResourcesIds.Sapphire, amount: 2.6 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Sapphire]: [
    { resource: ResourcesIds.Diamonds, amount: 5 },
    { resource: ResourcesIds.Ruby, amount: 3.9 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ruby]: [
    { resource: ResourcesIds.Sapphire, amount: 4.5 },
    { resource: ResourcesIds.DeepCrystal, amount: 4.4 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.DeepCrystal]: [
    { resource: ResourcesIds.Ruby, amount: 5.2 },
    { resource: ResourcesIds.Ignium, amount: 3.7 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ignium]: [
    { resource: ResourcesIds.DeepCrystal, amount: 5.4 },
    { resource: ResourcesIds.EtherealSilica, amount: 3.7 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.EtherealSilica]: [
    { resource: ResourcesIds.Ignium, amount: 5 },
    { resource: ResourcesIds.TrueIce, amount: 4.1 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.TrueIce]: [
    { resource: ResourcesIds.EtherealSilica, amount: 5.4 },
    { resource: ResourcesIds.TwilightQuartz, amount: 3.8 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.TwilightQuartz]: [
    { resource: ResourcesIds.TrueIce, amount: 5.6 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 3.7 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.AlchemicalSilver]: [
    { resource: ResourcesIds.TwilightQuartz, amount: 6.4 },
    { resource: ResourcesIds.Adamantine, amount: 3.1 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.AlchemicalSilver, amount: 7.2 },
    { resource: ResourcesIds.Mithral, amount: 2.8 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Adamantine, amount: 7.3 },
    { resource: ResourcesIds.Dragonhide, amount: 3.1 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Adamantine, amount: 6.6 },
    { resource: ResourcesIds.Mithral, amount: 4.4 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Donkey]: [
    { resource: ResourcesIds.Wheat, amount: 25 },
    { resource: ResourcesIds.Lords, amount: 0.01 },
  ],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Obsidian, amount: 5.3 },
    { resource: ResourcesIds.ColdIron, amount: 2.7 },
  ],
  [ResourcesIds.KnightT2]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 75 },
    { resource: ResourcesIds.Fish, amount: 75 },
    { resource: ResourcesIds.Ruby, amount: 3.1 },
    { resource: ResourcesIds.DeepCrystal, amount: 3.9 },
    { resource: ResourcesIds.Knight, amount: 0.1 },
  ],
  [ResourcesIds.KnightT3]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 100 },
    { resource: ResourcesIds.Fish, amount: 100 },
    { resource: ResourcesIds.TwilightQuartz, amount: 4.0 },
    { resource: ResourcesIds.Mithral, amount: 2.0 },
    { resource: ResourcesIds.KnightT2, amount: 0.1 },
  ],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Silver, amount: 4.4 },
    { resource: ResourcesIds.Ironwood, amount: 3.6 },
  ],
  [ResourcesIds.CrossbowmanT2]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 75 },
    { resource: ResourcesIds.Fish, amount: 75 },
    { resource: ResourcesIds.Diamonds, amount: 3.9 },
    { resource: ResourcesIds.EtherealSilica, amount: 3.1 },
    { resource: ResourcesIds.Crossbowman, amount: 0.1 },
  ],
  [ResourcesIds.CrossbowmanT3]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 100 },
    { resource: ResourcesIds.Fish, amount: 100 },
    { resource: ResourcesIds.TrueIce, amount: 4.8 },
    { resource: ResourcesIds.Dragonhide, amount: 1.2 },
    { resource: ResourcesIds.CrossbowmanT2, amount: 0.1 },
  ],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Copper, amount: 5.4 },
    { resource: ResourcesIds.Gold, amount: 2.6 },
  ],
  [ResourcesIds.PaladinT2]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 75 },
    { resource: ResourcesIds.Fish, amount: 75 },
    { resource: ResourcesIds.Sapphire, amount: 3.5 },
    { resource: ResourcesIds.Ignium, amount: 3.5 },
    { resource: ResourcesIds.Paladin, amount: 0.1 },
  ],
  [ResourcesIds.PaladinT3]: [
    // 2 times the output
    { resource: ResourcesIds.Wheat, amount: 100 },
    { resource: ResourcesIds.Fish, amount: 100 },
    { resource: ResourcesIds.AlchemicalSilver, amount: 3.1 },
    { resource: ResourcesIds.Adamantine, amount: 2.9 },
    { resource: ResourcesIds.PaladinT2, amount: 0.1 },
  ],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
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
  [ResourcesIds.Labor]: 0,
};
export const RESOURCE_PRODUCTION_OUTPUT_AMOUNTS_SIMPLE_SYSTEM: ResourceOutputs = RESOURCE_PRODUCTION_OUTPUT_AMOUNTS;

export const RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM: ResourceInputs = {
  [ResourcesIds.Wood]: [
    { resource: ResourcesIds.Labor, amount: 10.4 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Stone]: [
    { resource: ResourcesIds.Labor, amount: 10.4 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Coal]: [
    { resource: ResourcesIds.Labor, amount: 13.1 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Copper]: [
    { resource: ResourcesIds.Labor, amount: 16.35 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Obsidian]: [
    { resource: ResourcesIds.Labor, amount: 25.61 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Silver]: [
    { resource: ResourcesIds.Labor, amount: 29.12 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ironwood]: [
    { resource: ResourcesIds.Labor, amount: 39.91 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.ColdIron]: [
    { resource: ResourcesIds.Labor, amount: 48.49 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Gold]: [
    { resource: ResourcesIds.Labor, amount: 62.92 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Hartwood]: [
    { resource: ResourcesIds.Labor, amount: 79.82 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Diamonds]: [
    { resource: ResourcesIds.Labor, amount: 121.18 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Sapphire]: [
    { resource: ResourcesIds.Labor, amount: 172.12 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ruby]: [
    { resource: ResourcesIds.Labor, amount: 185.12 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.DeepCrystal]: [
    { resource: ResourcesIds.Labor, amount: 213.98 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Ignium]: [
    { resource: ResourcesIds.Labor, amount: 222.95 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.EtherealSilica]: [
    { resource: ResourcesIds.Labor, amount: 281.58 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.TrueIce]: [
    { resource: ResourcesIds.Labor, amount: 319.54 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.TwilightQuartz]: [
    { resource: ResourcesIds.Labor, amount: 367.25 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.AlchemicalSilver]: [
    { resource: ResourcesIds.Labor, amount: 504.01 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Adamantine]: [
    { resource: ResourcesIds.Labor, amount: 652.08 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Mithral]: [
    { resource: ResourcesIds.Labor, amount: 1075.75 },
    { resource: ResourcesIds.Fish, amount: 5 },
  ],
  [ResourcesIds.Dragonhide]: [
    { resource: ResourcesIds.Labor, amount: 1199.0 },
    { resource: ResourcesIds.Wheat, amount: 5 },
  ],
  [ResourcesIds.Donkey]: [],
  [ResourcesIds.Knight]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 26 },
  ],
  [ResourcesIds.KnightT2]: [],
  [ResourcesIds.KnightT3]: [],
  [ResourcesIds.Crossbowman]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 30 },
  ],
  [ResourcesIds.CrossbowmanT2]: [],
  [ResourcesIds.CrossbowmanT3]: [],
  [ResourcesIds.Paladin]: [
    { resource: ResourcesIds.Wheat, amount: 50 },
    { resource: ResourcesIds.Fish, amount: 50 },
    { resource: ResourcesIds.Labor, amount: 26 },
  ],
  [ResourcesIds.PaladinT2]: [],
  [ResourcesIds.PaladinT3]: [],
  [ResourcesIds.Wheat]: [],
  [ResourcesIds.Fish]: [],
  [ResourcesIds.Lords]: [],
  [ResourcesIds.AncientFragment]: [],
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
