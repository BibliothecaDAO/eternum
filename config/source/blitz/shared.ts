import { ResourcesIds } from "../../../packages/types/src/constants";
import type { ResourceCost, ResourceInputs, ResourceOutputs } from "../../../packages/types/src/types/common";
import {
  LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES,
  RESOURCE_PRODUCTION_INPUT_RESOURCES,
  RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
  RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
  STARTING_RESOURCES,
} from "./resources";
import type { ConfigPatch } from "../common/merge-config";

const REALM_DEPLOYED_START_TROOP_COUNT = 1_500;

export type BlitzBalanceProfileId = "official-60" | "official-90";
export type BlitzBalanceProfile = ConfigPatch;

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

function buildT2TroopRecipe(baseTroopResource: ResourcesIds, rareResource: ResourcesIds, profileMultiplier: number) {
  return [
    { resource: ResourcesIds.Wheat, amount: 3 },
    { resource: baseTroopResource, amount: 10 * profileMultiplier },
    { resource: ResourcesIds.Copper, amount: 0.2 * profileMultiplier },
    { resource: rareResource, amount: 0.6 * profileMultiplier },
    { resource: ResourcesIds.Essence, amount: 1 },
  ];
}

function buildT3TroopRecipe(
  baseTroopResource: ResourcesIds,
  rareResource: ResourcesIds,
  eliteResource: ResourcesIds,
  profileMultiplier: number,
) {
  return [
    { resource: ResourcesIds.Wheat, amount: 4 },
    { resource: baseTroopResource, amount: 10 * profileMultiplier },
    { resource: rareResource, amount: 0.4 * profileMultiplier },
    { resource: eliteResource, amount: 0.8 * profileMultiplier },
    { resource: ResourcesIds.Essence, amount: 3 },
  ];
}

export function buildOfficialBlitzComplexRecipes(profileMultiplier: number): ResourceInputs {
  return {
    ...RESOURCE_PRODUCTION_INPUT_RESOURCES,
    [ResourcesIds.Knight]: buildT1TroopRecipe(0.4 * profileMultiplier),
    [ResourcesIds.Crossbowman]: buildT1TroopRecipe(0.4 * profileMultiplier),
    [ResourcesIds.Paladin]: buildT1TroopRecipe(0.4 * profileMultiplier),
    [ResourcesIds.KnightT2]: buildT2TroopRecipe(ResourcesIds.Knight, ResourcesIds.ColdIron, profileMultiplier),
    [ResourcesIds.CrossbowmanT2]: buildT2TroopRecipe(
      ResourcesIds.Crossbowman,
      ResourcesIds.Ironwood,
      profileMultiplier,
    ),
    [ResourcesIds.PaladinT2]: buildT2TroopRecipe(ResourcesIds.Paladin, ResourcesIds.Gold, profileMultiplier),
    [ResourcesIds.KnightT3]: buildT3TroopRecipe(
      ResourcesIds.KnightT2,
      ResourcesIds.ColdIron,
      ResourcesIds.Mithral,
      profileMultiplier,
    ),
    [ResourcesIds.CrossbowmanT3]: buildT3TroopRecipe(
      ResourcesIds.CrossbowmanT2,
      ResourcesIds.Ironwood,
      ResourcesIds.Adamantine,
      profileMultiplier,
    ),
    [ResourcesIds.PaladinT3]: buildT3TroopRecipe(
      ResourcesIds.PaladinT2,
      ResourcesIds.Gold,
      ResourcesIds.Dragonhide,
      profileMultiplier,
    ),
  };
}

export function buildOfficialBlitzResourceOutputs(
  profileMultiplier: number,
  donkeyOutputAmount: number,
): ResourceOutputs {
  return {
    ...RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
    [ResourcesIds.Wood]: profileMultiplier,
    [ResourcesIds.Coal]: profileMultiplier,
    [ResourcesIds.Copper]: profileMultiplier,
    [ResourcesIds.Ironwood]: profileMultiplier,
    [ResourcesIds.ColdIron]: profileMultiplier,
    [ResourcesIds.Gold]: profileMultiplier,
    [ResourcesIds.Adamantine]: profileMultiplier,
    [ResourcesIds.Mithral]: profileMultiplier,
    [ResourcesIds.Dragonhide]: profileMultiplier,
    [ResourcesIds.Donkey]: donkeyOutputAmount,
    [ResourcesIds.Knight]: 5 * profileMultiplier,
    [ResourcesIds.KnightT2]: 5 * profileMultiplier,
    [ResourcesIds.KnightT3]: 5 * profileMultiplier,
    [ResourcesIds.Crossbowman]: 5 * profileMultiplier,
    [ResourcesIds.CrossbowmanT2]: 5 * profileMultiplier,
    [ResourcesIds.CrossbowmanT3]: 5 * profileMultiplier,
    [ResourcesIds.Paladin]: 5 * profileMultiplier,
    [ResourcesIds.PaladinT2]: 5 * profileMultiplier,
    [ResourcesIds.PaladinT3]: 5 * profileMultiplier,
  };
}

export function buildOfficialBlitzSimpleRecipes(profileMultiplier: number): ResourceInputs {
  return {
    ...RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
    [ResourcesIds.Wood]: buildSimpleResourceRecipe(1, 0.5 * profileMultiplier),
    [ResourcesIds.Coal]: buildSimpleResourceRecipe(1, 1 * profileMultiplier),
    [ResourcesIds.Copper]: buildSimpleResourceRecipe(1, 1 * profileMultiplier),
    [ResourcesIds.Ironwood]: buildSimpleResourceRecipe(2, 2.5 * profileMultiplier),
    [ResourcesIds.ColdIron]: buildSimpleResourceRecipe(2, 2.5 * profileMultiplier),
    [ResourcesIds.Gold]: buildSimpleResourceRecipe(2, 2.5 * profileMultiplier),
    [ResourcesIds.Adamantine]: buildSimpleResourceRecipe(4, 10 * profileMultiplier),
    [ResourcesIds.Mithral]: buildSimpleResourceRecipe(4, 10 * profileMultiplier),
    [ResourcesIds.Dragonhide]: buildSimpleResourceRecipe(4, 10 * profileMultiplier),
    [ResourcesIds.Knight]: buildSimpleResourceRecipe(2, 0.5 * profileMultiplier),
    [ResourcesIds.Crossbowman]: buildSimpleResourceRecipe(2, 0.5 * profileMultiplier),
    [ResourcesIds.Paladin]: buildSimpleResourceRecipe(2, 0.5 * profileMultiplier),
  };
}

export function buildOfficialBlitzLaborOutputs(profileMultiplier: number): ResourceOutputs {
  return {
    ...LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES,
    [ResourcesIds.Wood]: 1 * profileMultiplier,
    [ResourcesIds.Coal]: 2 * profileMultiplier,
    [ResourcesIds.Copper]: 2 * profileMultiplier,
    [ResourcesIds.Ironwood]: 5 * profileMultiplier,
    [ResourcesIds.ColdIron]: 5 * profileMultiplier,
    [ResourcesIds.Gold]: 5 * profileMultiplier,
    [ResourcesIds.Adamantine]: 20 * profileMultiplier,
    [ResourcesIds.Mithral]: 20 * profileMultiplier,
    [ResourcesIds.Dragonhide]: 20 * profileMultiplier,
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

export function buildBlitzStartingResources(
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
