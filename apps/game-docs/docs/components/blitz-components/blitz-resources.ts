import { ETERNUM_CONFIG } from "@/utils/config";
import { RESOURCE_RARITY, ResourcesIds, resources } from "@bibliothecadao/types";

export type RecipeInput = { resource: number; amount: number };
export type Recipe = { id: number; inputs: RecipeInput[]; output: number };

export const TROOPS = new Set<number>([
  ResourcesIds.Knight,
  ResourcesIds.KnightT2,
  ResourcesIds.KnightT3,
  ResourcesIds.Crossbowman,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.Paladin,
  ResourcesIds.PaladinT2,
  ResourcesIds.PaladinT3,
]);

/**
 * Blitz's production recipes as the game reads them: each produced resource with its inputs per second (Wheat first)
 * and its output per second. Research is left out: it is studied from Fish and Lords, not produced from materials.
 */
export const blitzRecipes = (): Recipe[] => {
  const { productionByComplexRecipe, productionByComplexRecipeOutputs } = ETERNUM_CONFIG("blitz").resources;
  return Object.entries(productionByComplexRecipe as Record<string, RecipeInput[]>)
    .filter(([id, inputs]) => inputs.length > 0 && Number(id) !== ResourcesIds.Research)
    .map(([id, inputs]) => ({
      id: Number(id),
      inputs: inputs.toSorted(
        (a, b) => Number(b.resource === ResourcesIds.Wheat) - Number(a.resource === ResourcesIds.Wheat),
      ),
      output: productionByComplexRecipeOutputs[id],
    }));
};

const byRarity = (a: number, b: number) => (RESOURCE_RARITY[a] ?? 0) - (RESOURCE_RARITY[b] ?? 0);

/** The materials Blitz produces, rarest last. */
export const blitzMaterials = (): number[] =>
  blitzRecipes()
    .map((recipe) => recipe.id)
    .filter((id) => !TROOPS.has(id) && id !== ResourcesIds.Donkey)
    .toSorted(byRarity);

export const tierOf = (id: number) => Number(/T(\d)$/.exec(ResourcesIds[id] ?? "")?.[1] ?? 1);

/** The troops tier by tier: Knight, Crossbowman and Paladin within each. */
export const byTroopTier = (a: number, b: number) => tierOf(a) - tierOf(b) || a - b;

/** A resource's name; a troop's carries its tier ("KnightT2" reads "T2 Knight", a tier 1 troop "T1 Knight"). */
export const nameOf = (id: number): string => {
  const trait = resources.find((resource) => resource.id === id)?.trait ?? `Resource ${id}`;
  return TROOPS.has(id) ? `T${tierOf(id)} ${trait.replace(/T\d$/, "")}` : trait;
};
