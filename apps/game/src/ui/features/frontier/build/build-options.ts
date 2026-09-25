import { getBuildingCosts, isRealmMarkedPlot, ResourceManager } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

/**
 * What Frontier's build sheet needs for one plot, read from facts with no UI of its own: each building the realm may
 * raise there with its price, what it gives (the marked ring plot doubles it, as the contract's building_effect does),
 * its population cost and the realm's wheat an hour after it stands. The sheet's look comes from the visual redo.
 */
const FRONTIER_BUILDINGS = [
  BuildingType.ResourceWheat,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceLabor,
  BuildingType.Storehouse,
  BuildingType.WorkersHut,
] as const;

const TROOP_RESOURCES = new Set<number>([ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin]);

type BuildEffect =
  | { kind: "produces"; resource: ResourcesIds; perHour: number }
  | { kind: "capacity"; amount: number }
  | { kind: "population"; amount: number };

interface BuildOption {
  category: BuildingType;
  cost: { resource: number; amount: number }[];
  effect: BuildEffect;
  populationCost: number;
  /** The ring's marked plot doubles what the building gives. */
  doubled: boolean;
  /** The realm's net wheat an hour once it stands; unknown while the realm's wheat is. */
  wheatAfter: number | undefined;
}

export const readBuildOptions = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  plot: { col: number; row: number },
  useSimpleCost: boolean,
): BuildOption[] => {
  const doubled = isRealmMarkedPlot(store, realm, plot);
  const wheat = new ResourceManager(store, realm.entity_id).wheatPerHour();
  return FRONTIER_BUILDINGS.map((category) => {
    const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
    const effect = buildingEffect(store, realm, rule, doubled ? 2 : 1);
    const cost = getBuildingCosts(realm.entity_id, store, category, useSimpleCost);
    if (!cost) throw new Error(`No cost for building ${category}`);
    return {
      category,
      cost,
      effect,
      populationCost: rule.population_cost,
      doubled,
      wheatAfter: wheat === undefined ? undefined : wheat.produced - wheat.consumed + wheatChange(store, realm, effect),
    };
  });
};

/** What a building gives at the realm, as the contract's building_effect computes it, times the plot's multiplier. */
const buildingEffect = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rule: NativeRows["BuildingRule"],
  multiplier: number,
): BuildEffect => {
  const category = rule.category as BuildingType;
  if (category === BuildingType.Storehouse) {
    const { capacity_config } = store.require("SliceRules", { game_id: realm.game_id });
    return { kind: "capacity", amount: capacity_config.storehouse_boost_capacity * multiplier };
  }
  if (category === BuildingType.WorkersHut) return { kind: "population", amount: rule.capacity_grant * multiplier };
  let resource = getProducedResource(category);
  if (resource === undefined) throw new Error(`Building ${category} produces nothing`);
  // A barracks trains the troop of the realm's barracks tier.
  if (TROOP_RESOURCES.has(resource)) resource = (resource + realm.metadata.barracks_tier) as ResourcesIds;
  const perSecond =
    category === BuildingType.ResourceLabor
      ? store.require("BoardRules", { game_id: realm.game_id }).workshop_rate
      : store.require("ResourceRule", { game_id: realm.game_id, resource_type: resource }).realm_rate;
  return { kind: "produces", resource, perHour: (Number(perSecond) / RESOURCE_PRECISION) * 3600 * multiplier };
};

/** A farm adds its wheat; a barracks eats its troops' recipe wheat; nothing else touches the wheat. */
const wheatChange = (store: NativeFactStore, realm: NativeRows["Structure"], effect: BuildEffect): number => {
  if (effect.kind !== "produces") return 0;
  if (effect.resource === ResourcesIds.Wheat) return effect.perHour;
  if (!TROOP_RESOURCES.has(effect.resource - realm.metadata.barracks_tier)) return 0;
  const recipe = store.require("ProductionRecipe", { game_id: realm.game_id, resource_type: effect.resource });
  const input = recipe.simple_inputs[0];
  if (recipe.simple_output === 0n || input?.resource_type !== ResourcesIds.Wheat)
    throw new Error("A barracks trains from a wheat recipe");
  return -(effect.perHour * Number(input.amount)) / Number(recipe.simple_output);
};
