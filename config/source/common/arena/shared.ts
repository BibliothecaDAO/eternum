import { ResourcesIds } from "../../../../packages/types/src/constants";
import type { ResourceCost, ResourceInputs, ResourceOutputs } from "../../../../packages/types/src/types/common";
import {
  RESOURCE_PRODUCTION_INPUT_RESOURCES,
  RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
  RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
  STARTING_RESOURCES,
} from "./resources";

const REALM_DEPLOYED_START_TROOP_COUNT = 1_500;

function buildSimpleResourceRecipe(wheatAmount: number, laborAmount: number) {
  return [
    { resource: ResourcesIds.Wheat, amount: wheatAmount },
    { resource: ResourcesIds.Labor, amount: laborAmount },
  ];
}

function buildT1TroopRecipe(copperAmount: number) {
  return [
    { resource: ResourcesIds.Wheat, amount: 2 },
    { resource: ResourcesIds.Copper, amount: copperAmount },
  ];
}

function buildT2TroopRecipe(baseTroopResource: ResourcesIds, rareResource: ResourcesIds, multiplier: number) {
  return [
    { resource: ResourcesIds.Wheat, amount: 3 },
    { resource: baseTroopResource, amount: 10 * multiplier },
    { resource: ResourcesIds.Copper, amount: 0.2 * multiplier },
    { resource: rareResource, amount: 0.6 * multiplier },
    { resource: ResourcesIds.Essence, amount: 1 },
  ];
}

function buildT3TroopRecipe(
  baseTroopResource: ResourcesIds,
  rareResource: ResourcesIds,
  eliteResource: ResourcesIds,
  multiplier: number,
) {
  return [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: baseTroopResource, amount: 10 * multiplier },
    { resource: rareResource, amount: 0.4 * multiplier },
    { resource: eliteResource, amount: 0.8 * multiplier },
    { resource: ResourcesIds.Essence, amount: 3 },
  ];
}

export function buildOfficialArenaComplexRecipes(multiplier: number): ResourceInputs {
  return {
    ...RESOURCE_PRODUCTION_INPUT_RESOURCES,
    [ResourcesIds.Knight]: buildT1TroopRecipe(0.4 * multiplier),
    [ResourcesIds.Crossbowman]: buildT1TroopRecipe(0.4 * multiplier),
    [ResourcesIds.Paladin]: buildT1TroopRecipe(0.4 * multiplier),
    [ResourcesIds.KnightT2]: buildT2TroopRecipe(ResourcesIds.Knight, ResourcesIds.ColdIron, multiplier),
    [ResourcesIds.CrossbowmanT2]: buildT2TroopRecipe(ResourcesIds.Crossbowman, ResourcesIds.Ironwood, multiplier),
    [ResourcesIds.PaladinT2]: buildT2TroopRecipe(ResourcesIds.Paladin, ResourcesIds.Gold, multiplier),
    [ResourcesIds.KnightT3]: buildT3TroopRecipe(
      ResourcesIds.KnightT2,
      ResourcesIds.ColdIron,
      ResourcesIds.Mithral,
      multiplier,
    ),
    [ResourcesIds.CrossbowmanT3]: buildT3TroopRecipe(
      ResourcesIds.CrossbowmanT2,
      ResourcesIds.Ironwood,
      ResourcesIds.Adamantine,
      multiplier,
    ),
    [ResourcesIds.PaladinT3]: buildT3TroopRecipe(
      ResourcesIds.PaladinT2,
      ResourcesIds.Gold,
      ResourcesIds.Dragonhide,
      multiplier,
    ),
  };
}

export function buildOfficialArenaResourceOutputs(multiplier: number): ResourceOutputs {
  return {
    ...RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
    [ResourcesIds.Wood]: multiplier,
    [ResourcesIds.Coal]: multiplier,
    [ResourcesIds.Copper]: multiplier,
    [ResourcesIds.Ironwood]: multiplier,
    [ResourcesIds.ColdIron]: multiplier,
    [ResourcesIds.Gold]: multiplier,
    [ResourcesIds.Adamantine]: multiplier,
    [ResourcesIds.Mithral]: multiplier,
    [ResourcesIds.Dragonhide]: multiplier,
    [ResourcesIds.Labor]: multiplier,
    [ResourcesIds.Knight]: 5 * multiplier,
    [ResourcesIds.KnightT2]: 5 * multiplier,
    [ResourcesIds.KnightT3]: 5 * multiplier,
    [ResourcesIds.Crossbowman]: 5 * multiplier,
    [ResourcesIds.CrossbowmanT2]: 5 * multiplier,
    [ResourcesIds.CrossbowmanT3]: 5 * multiplier,
    [ResourcesIds.Paladin]: 5 * multiplier,
    [ResourcesIds.PaladinT2]: 5 * multiplier,
    [ResourcesIds.PaladinT3]: 5 * multiplier,
  };
}

export function buildOfficialArenaSimpleRecipes(multiplier: number): ResourceInputs {
  return {
    ...RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
    [ResourcesIds.Wood]: buildSimpleResourceRecipe(1, 0.5 * multiplier),
    [ResourcesIds.Coal]: buildSimpleResourceRecipe(1, 1 * multiplier),
    [ResourcesIds.Copper]: buildSimpleResourceRecipe(1, 1 * multiplier),
    [ResourcesIds.Ironwood]: buildSimpleResourceRecipe(2, 2.5 * multiplier),
    [ResourcesIds.ColdIron]: buildSimpleResourceRecipe(2, 2.5 * multiplier),
    [ResourcesIds.Gold]: buildSimpleResourceRecipe(2, 2.5 * multiplier),
    [ResourcesIds.Adamantine]: buildSimpleResourceRecipe(4, 10 * multiplier),
    [ResourcesIds.Mithral]: buildSimpleResourceRecipe(4, 10 * multiplier),
    [ResourcesIds.Dragonhide]: buildSimpleResourceRecipe(4, 10 * multiplier),
    [ResourcesIds.Knight]: buildSimpleResourceRecipe(2, 0.5 * multiplier),
    [ResourcesIds.Crossbowman]: buildSimpleResourceRecipe(2, 0.5 * multiplier),
    [ResourcesIds.Paladin]: buildSimpleResourceRecipe(2, 0.5 * multiplier),
  };
}

export function buildComplexBuildingCost(rareResource: ResourcesIds, essenceAmount: number): ResourceCost[] {
  return [
    { resource: ResourcesIds.Labor, amount: 360 },
    { resource: ResourcesIds.Wood, amount: 240 },
    { resource: ResourcesIds.Copper, amount: 180 },
    { resource: rareResource, amount: 60 },
    { resource: ResourcesIds.Essence, amount: essenceAmount },
  ];
}

export function buildEliteBuildingCost(
  rareResource: ResourcesIds,
  eliteResource: ResourcesIds,
  essenceAmount: number,
): ResourceCost[] {
  return [
    { resource: ResourcesIds.Labor, amount: 540 },
    { resource: ResourcesIds.Wood, amount: 360 },
    { resource: rareResource, amount: 240 },
    { resource: eliteResource, amount: 120 },
    { resource: ResourcesIds.Essence, amount: essenceAmount },
  ];
}

function isRealmStartingTroopResource(resource: ResourcesIds): boolean {
  return resource === ResourcesIds.Knight || resource === ResourcesIds.Crossbowman || resource === ResourcesIds.Paladin;
}

export function buildArenaStartingResources(
  startingResourceAmounts: Partial<Record<ResourcesIds, number>>,
  targetRealmTroopCount: number,
): ResourceCost[] {
  const startingTroopAmount = targetRealmTroopCount - REALM_DEPLOYED_START_TROOP_COUNT;

  return STARTING_RESOURCES.map((resource) => {
    if (isRealmStartingTroopResource(resource.resource)) {
      return {
        ...resource,
        amount: startingTroopAmount,
      };
    }

    const nextAmount = startingResourceAmounts[resource.resource];
    if (nextAmount === undefined) {
      return resource;
    }

    return {
      ...resource,
      amount: nextAmount,
    };
  });
}
