import { getBuildingCosts, isRealmMarkedPlot, researchedBuildingTier, ResourceManager } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

/**
 * What Frontier's build sheet needs for one plot, read from facts with no UI of its own: each building the realm may
 * raise there, at the tier its research has reached, with its price (the tiers' labor included), what it gives (the
 * tier's multipliers and the marked ring plot's ×2, as the contract's building_effect applies them), its population
 * cost and the realm's wheat an hour after it stands. Unknown while the realm's research is.
 */
const FRONTIER_BUILDINGS = [
  BuildingType.ResourceWheat,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceLabor,
  BuildingType.Storehouse,
  BuildingType.WorkersHut,
] as const;

const TROOP_RESOURCES = new Set<number>([ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin]);
/** Every troop a barracks can train, T1 to T3 of each kind. */
const TRAINED_TROOPS = new Set<number>(Array.from({ length: 9 }, (_, index) => ResourcesIds.Knight + index));

export type BuildEffect =
  | { kind: "produces"; resource: ResourcesIds; perHour: number }
  | { kind: "capacity"; amount: number }
  | { kind: "population"; amount: number };

export interface BuildOption {
  category: BuildingType;
  /** The tier it rises at: the highest the realm has researched. */
  tier: 1 | 2 | 3;
  cost: { resource: number; amount: number }[];
  effect: BuildEffect;
  populationCost: number;
  /** The ring's marked plot doubles what the building gives. */
  doubled: boolean;
  /** What it does to the realm's wheat an hour, and the realm's net wheat once it stands (unknown while that is). */
  wheat: { change: number; after: number | undefined };
}

export const readBuildOptions = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  plot: { col: number; row: number },
  useSimpleCost: boolean,
): BuildOption[] | undefined => {
  const doubled = isRealmMarkedPlot(store, realm, plot);
  const wheat = new ResourceManager(store, realm.entity_id).wheatPerHour();
  const options: BuildOption[] = [];
  for (const category of FRONTIER_BUILDINGS) {
    const tier = researchedBuildingTier(store, realm.game_id, realm.entity_id, category);
    const cost = getBuildingCosts(realm.entity_id, store, category, useSimpleCost);
    if (tier === undefined || cost === undefined) return undefined;
    const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
    const effect = readBuildingEffect(store, realm, category, tier as BuildOption["tier"], doubled ? 2 : 1);
    const change = wheatChange(store, realm, effect);
    options.push({
      category,
      tier: tier as BuildOption["tier"],
      cost,
      effect,
      populationCost: rule.population_cost,
      doubled,
      wheat: { change, after: wheat === undefined ? undefined : wheat.produced - wheat.consumed + change },
    });
  }
  return options;
};

/**
 * What a building gives at the realm, as the contract's building_effect computes it at its tier and on its plot (×2 on
 * the marked one): the one reading of it, for the build sheet, the upgrade sheet and research's gains.
 */
export const readBuildingEffect = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
  tier: BuildOption["tier"],
  multiplier: number,
): BuildEffect => {
  const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
  // Tier I has no rule of its own: it is the base building.
  const tierRule = tier > 1 ? store.require("BuildingTierRule", { game_id: realm.game_id, category, tier }) : undefined;
  const scaled = (value: number, bps: number | undefined) => ((value * (bps ?? 10_000)) / 10_000) * multiplier;
  if (category === BuildingType.Storehouse) {
    const { capacity_config } = store.require("SliceRules", { game_id: realm.game_id });
    return {
      kind: "capacity",
      amount: scaled(capacity_config.storehouse_boost_capacity, tierRule?.capacity_multiplier_bps),
    };
  }
  if (category === BuildingType.WorkersHut)
    return { kind: "population", amount: scaled(rule.capacity_grant, tierRule?.population_multiplier_bps) };
  let resource = getProducedResource(category);
  if (resource === undefined) throw new Error(`Building ${category} produces nothing`);
  // A barracks trains the troop of its own tier.
  if (TROOP_RESOURCES.has(resource)) resource = (resource + tier - 1) as ResourcesIds;
  const perSecond =
    category === BuildingType.ResourceLabor
      ? store.require("BoardRules", { game_id: realm.game_id }).workshop_rate
      : store.require("ResourceRule", { game_id: realm.game_id, resource_type: resource }).realm_rate;
  return {
    kind: "produces",
    resource,
    perHour: scaled((Number(perSecond) / RESOURCE_PRECISION) * 3600, tierRule?.output_multiplier_bps),
  };
};

/** A farm adds its wheat; a barracks eats its troops' recipe wheat; nothing else touches the wheat. */
const wheatChange = (store: NativeFactStore, realm: NativeRows["Structure"], effect: BuildEffect): number => {
  if (effect.kind !== "produces") return 0;
  if (effect.resource === ResourcesIds.Wheat) return effect.perHour;
  if (!TRAINED_TROOPS.has(effect.resource)) return 0;
  const recipe = store.require("ProductionRecipe", { game_id: realm.game_id, resource_type: effect.resource });
  const input = recipe.simple_inputs[0];
  if (recipe.simple_output === 0n || input?.resource_type !== ResourcesIds.Wheat)
    throw new Error("A barracks trains from a wheat recipe");
  return -(effect.perHour * Number(input.amount)) / Number(recipe.simple_output);
};
