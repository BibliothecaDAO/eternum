import { type IconMeaning } from "@/ui/design-system/icon";
import {
  buildingCostRise,
  getBuildingCosts,
  getBuildingQuantity,
  realmLearned,
  researchPurchases,
  researchRowOf,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import {
  safeInteger,
  nativeResearchConstants,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, getProducedResource, ResourcesIds } from "@bibliothecadao/types";

import { LABOR, TROOPS, WHEAT } from "@/ui/design-system/kit/words";
import { type BuildingOutput, buildingOutput } from "@/ui/shared/lib/building-output";

import { type ResearchShare, researchShare } from "../production/store-makers";

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

/** What a Frontier building makes: wheat, labor, or the realm's one troop type. */
type Product = ResourcesIds.Wheat | ResourcesIds.Labor | ResourcesIds.Knight;

/**
 * Each product as the sheets show it: its icon, its glossary word and the realm store that holds it. Keyed by the
 * products themselves, so one without its word or icon does not compile, and no sheet looks one up at its own risk.
 */
export const PRODUCTS: Record<Product, { icon: IconMeaning; word: string; store: "wheat" | "labor" | "troops" }> = {
  [ResourcesIds.Wheat]: { icon: "wheat", word: WHEAT, store: "wheat" },
  [ResourcesIds.Labor]: { icon: "labor", word: LABOR, store: "labor" },
  [ResourcesIds.Knight]: { icon: "troops", word: TROOPS, store: "troops" },
};

const isProduct = (resource: ResourcesIds | undefined): resource is Product =>
  resource !== undefined && resource in PRODUCTS;

export type BuildEffect =
  | { kind: "produces"; resource: Product; perHour: number; output: BuildingOutput; research?: ResearchShare }
  | { kind: "population"; amount: number }
  | { kind: "trains"; attribute: "Battle" | "Logistics" | "Scouting" | "Homecoming" };

export interface BuildOption {
  category: BuildingType;
  /** Its type's tier, 1 (common) to 5 (legendary): tiers apply to every building of the type. */
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  cost: { resource: number; amount: number }[];
  /** How the price has risen: the copies already standing and what they multiply the base price by (1 with none). */
  rise: { standing: number; times: number };
  effect: BuildEffect;
  populationCost: number;
  /**
   * Whether it can rise now: a training building is unique on the board and opens when purchases across both
   * Barracks sides reach the board's gate (the contract's assert_board_category).
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
  const wheat = new ResourceManager(store, safeInteger(realm.entity_id)).wheatPerHour(tick);
  const board = store.require("BoardRules", { game_id: realm.game_id });
  const barracksPurchases = researchPurchases(learned, nativeResearchConstants.ROW_BARRACKS);
  const options: BuildOption[] = [];
  for (const category of FRONTIER_BUILDINGS) {
    const cost = getBuildingCosts(safeInteger(realm.entity_id), store, category, useSimpleCost);
    if (cost === undefined) return undefined;
    const rule = store.require("BuildingRule", { game_id: realm.game_id, category });
    const effect = readBuildingEffect(store, realm, category, learned);
    const change = wheatChange(effect);
    const row = researchRowOf(category);
    options.push({
      category,
      tier: (row === undefined
        ? 1
        : Math.max(TRAINS[category] ? 1 : 0, researchTier(learned, row))) as BuildOption["tier"],
      cost,
      rise: buildingCostRise(safeInteger(realm.entity_id), category, store),
      effect,
      populationCost: rule.population_cost,
      standing: !TRAINS[category]
        ? "open"
        : getBuildingQuantity(safeInteger(realm.entity_id), category, store) > 0
          ? "built"
          : barracksPurchases < board.training_gate_tier
            ? { gate: board.training_gate_tier }
            : "open",
      wheat: { change, after: wheat === undefined ? undefined : wheat + change },
    });
  }
  return options;
};

/**
 * What one building of a type gives at the realm with the given research, as the contract's board_output and
 * hut_bonus compute it: each Fields, Tools or Drill pick adds a share of the base output; one more Hut adds what
 * nextHutGrant says. The one reading of it, for the build sheet and research's gains.
 */
const readBuildingEffect = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
  learned: bigint,
): BuildEffect => {
  const trains = TRAINS[category];
  if (trains) return { kind: "trains", attribute: trains };
  if (category === BuildingType.WorkersHut) return { kind: "population", amount: nextHutGrant(store, realm, learned) };
  const resource = getProducedResource(category);
  if (!isProduct(resource)) throw new Error(`Building ${category} makes nothing a Frontier realm stores`);
  const research = researchShare(store, realm, resource, learned);
  const output = buildingOutput(store, realm, category, research?.picks ?? 0);
  return { kind: "produces", resource, perHour: output.total * 3600, output, research };
};

/**
 * The population one more Hut grants the realm, as the contract applies it (construction.cairo's
 * change_board_building, buildings.cairo's hut_bonus): its rule's capacity_grant, plus the change in the realm's whole
 * Hut bonus from the Huts standing to one more. That bonus is every standing Hut's grant × the Hut row's tier × the
 * board's step, rounded down over them all, so the next Hut's share alternates (+8, then +7 at the first tier).
 */
const nextHutGrant = (store: NativeFactStore, realm: NativeRows["Structure"], learned: bigint): number => {
  const rule = store.require("BuildingRule", { game_id: realm.game_id, category: BuildingType.WorkersHut });
  const board = store.require("BoardRules", { game_id: realm.game_id });
  const tier = researchTier(learned, nativeResearchConstants.ROW_HUT);
  const huts = getBuildingQuantity(safeInteger(realm.entity_id), BuildingType.WorkersHut, store);
  const bonus = (standing: number) =>
    Math.floor((standing * rule.capacity_grant * tier * board.population_step_bps) / 10_000);
  return rule.capacity_grant + bonus(huts + 1) - bonus(huts);
};

/** A farm adds its wheat; nothing a building produces consumes any (armies pay theirs when they deploy). */
const wheatChange = (effect: BuildEffect): number =>
  effect.kind === "produces" && effect.resource === ResourcesIds.Wheat ? effect.perHour : 0;
