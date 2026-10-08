import {
  getBuildingCosts,
  getBuildingQuantity,
  realmLearned,
  researchChoice,
  researchRowOf,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { nativeResearchConstants, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

/**
 * What Frontier's build sheet needs for one plot, read from facts with no UI of its own: each building the realm may
 * raise there, its type's tier, its price, what it gives (with its type's tiers, as the contract's board_output and
 * hut_bonus apply them), its population cost and the realm's wheat an hour after it stands. Unknown while the realm's
 * research is.
 */
const FRONTIER_BUILDINGS = [
  BuildingType.ResourceWheat,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceLabor,
  BuildingType.WorkersHut,
  BuildingType.WarHall,
  BuildingType.SupplyYard,
  BuildingType.ScoutsLodge,
  BuildingType.Hearth,
] as const;

/** Each training building and the attribute it trains every new army in. */
const TRAINS: Partial<Record<BuildingType, "Battle" | "Logistics" | "Scouting" | "Homecoming">> = {
  [BuildingType.WarHall]: "Battle",
  [BuildingType.SupplyYard]: "Logistics",
  [BuildingType.ScoutsLodge]: "Scouting",
  [BuildingType.Hearth]: "Homecoming",
};

export type BuildEffect =
  | { kind: "produces"; resource: ResourcesIds; perHour: number }
  | { kind: "population"; amount: number }
  | { kind: "trains"; attribute: "Battle" | "Logistics" | "Scouting" | "Homecoming" };

export interface BuildOption {
  category: BuildingType;
  /** Its type's tier, 1 (common) to 5 (legendary): tiers apply to every building of the type. */
  tier: 1 | 2 | 3 | 4 | 5;
  cost: { resource: number; amount: number }[];
  effect: BuildEffect;
  populationCost: number;
  /**
   * Whether it can rise now: a training building is unique on the board, and opens once the Barracks row reaches the
   * board's gate tier (the contract's assert_board_category).
   */
  standing: "open" | "built" | { gate: number };
  /** What it adds to the realm's wheat an hour, and the realm's wheat an hour once it stands (unknown while that is). */
  wheat: { change: number; after: number | undefined };
}

export const readBuildOptions = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  useSimpleCost: boolean,
  tick: number,
): BuildOption[] | undefined => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (learned === undefined) return undefined;
  const wheat = new ResourceManager(store, realm.entity_id).wheatPerHour(tick);
  const board = store.require("BoardRules", { game_id: realm.game_id });
  const barracksTier = researchTier(learned, nativeResearchConstants.ROW_BARRACKS);
  const options: BuildOption[] = [];
  for (const category of FRONTIER_BUILDINGS) {
    const cost = getBuildingCosts(realm.entity_id, store, category, useSimpleCost);
    if (cost === undefined) return undefined;
    const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
    const effect = readBuildingEffect(store, realm, category, learned);
    const change = wheatChange(effect);
    const row = researchRowOf(category);
    options.push({
      category,
      tier: (row === undefined ? 1 : researchTier(learned, row) + 1) as BuildOption["tier"],
      cost,
      effect,
      populationCost: rule.population_cost,
      standing: !TRAINS[category]
        ? "open"
        : getBuildingQuantity(realm.entity_id, category, store) > 0
          ? "built"
          : barracksTier < board.training_gate_tier
            ? { gate: board.training_gate_tier }
            : "open",
      wheat: { change, after: wheat === undefined ? undefined : wheat + change },
    });
  }
  return options;
};

/**
 * What one building of a type gives at the realm with the given research, as the contract's board_output and
 * hut_bonus compute it: each Fields, Tools or Drill pick adds a share of the base output, each hut tier a share of a
 * hut's population. The one reading of it, for the build sheet and research's gains.
 */
const readBuildingEffect = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
  learned: bigint,
): BuildEffect => {
  const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
  const board = store.require("BoardRules", { game_id: realm.game_id });
  const row = researchRowOf(category);
  const tier = row === undefined ? 0 : researchTier(learned, row);
  const trains = TRAINS[category];
  if (trains) return { kind: "trains", attribute: trains };
  if (category === BuildingType.WorkersHut)
    return {
      kind: "population",
      amount: rule.capacity_grant + (rule.capacity_grant * tier * board.population_step_bps) / 10_000,
    };
  const resource = getProducedResource(category);
  if (resource === undefined) throw new Error(`Building ${category} produces nothing`);
  let makes = 0;
  for (let at = 1; at <= tier; at++) if (researchChoice(learned, row!, at) === 0) makes++;
  const perSecond =
    category === BuildingType.ResourceLabor
      ? board.workshop_rate
      : store.require("ResourceRule", { game_id: realm.game_id, resource_type: resource }).realm_rate;
  return {
    kind: "produces",
    resource,
    perHour: ((Number(perSecond) / RESOURCE_PRECISION) * 3600 * (10_000 + makes * board.output_step_bps)) / 10_000,
  };
};

/** A farm adds its wheat; nothing a building produces consumes any (armies pay theirs when they deploy). */
const wheatChange = (effect: BuildEffect): number =>
  effect.kind === "produces" && effect.resource === ResourcesIds.Wheat ? effect.perHour : 0;
