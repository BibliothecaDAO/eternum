import {
  buildingCostRise,
  isOathResearch,
  getBuildingCosts,
  getBuildingQuantity,
  realmLearned,
  researchRowCategory,
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

import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { type BuildingOutput, buildingOutput } from "@/ui/shared/lib/building-output";

import { madePicks } from "../production/store-makers";
import { madeStoreOf, type MadeResource } from "../stores";

/**
 * What Frontier's build sheet needs for one plot, read from facts with no UI of its own: each building the realm may
 * raise there, its type's tier, its price, what it gives (with its type's tiers, as the contract's board_output and
 * hut_bonus apply them), its population cost and the realm's wheat an hour after it stands. Unknown while the realm's
 * research is.
 */
const FRONTIER_BUILDINGS = [...(Object.values(researchRowCategory) as BuildingType[]), BuildingType.Storehouse];

/** Each training building and the attribute it trains every new army in. */
const TRAINS: Partial<Record<BuildingType, "Logistics">> = {
  [BuildingType.SupplyYard]: "Logistics",
};

/** What a Frontier building makes: what one of the realm's made stores holds. */
type Product = MadeResource;

const isProduct = (resource: ResourcesIds | undefined): resource is Product => madeStoreOf(resource) !== undefined;

export type BuildEffect =
  | { kind: "produces"; resource: Product; perHour: number; output: BuildingOutput }
  | { kind: "population"; amount: number }
  | { kind: "trains"; attribute: "Logistics" }
  | { kind: "stores"; shareBps: number }
  | { kind: "research"; line: string; icon: "troops" | "wheat" };

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
   * Whether it can rise now: Supply yard is unique, while Scout production requires City.
   */
  standing: "open" | "built" | { level: number };
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
        : Math.max(
            isTraining(category) || isOathResearch(row) ? 1 : 0,
            researchTier(learned, row),
          )) as BuildOption["tier"],
      cost,
      rise: buildingCostRise(safeInteger(realm.entity_id), category, store),
      effect,
      populationCost: rule.population_cost,
      standing: buildingStanding(store, realm, category),
      wheat: { change, after: wheat === undefined ? undefined : wheat + change },
    });
  }
  return options;
};

const isTraining = (category: BuildingType) =>
  Boolean(TRAINS[category]) || category === BuildingType.ConscriptionCamp || category === BuildingType.RationsDepot;

const isOnePerRealm = (category: BuildingType) => isTraining(category) || category === BuildingType.Storehouse;

const buildingStanding = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
): BuildOption["standing"] => {
  const minimum =
    category === BuildingType.ScoutsLodge
      ? nativeResearchConstants.SCOUTS_LODGE_LEVEL
      : category === BuildingType.ResourceCrossbowmanT1
        ? nativeResearchConstants.RANGE_LEVEL
        : category === BuildingType.ConscriptionCamp
          ? nativeResearchConstants.CONSCRIPTION_CAMP_LEVEL
          : category === BuildingType.RationsDepot
            ? nativeResearchConstants.RATIONS_DEPOT_LEVEL
            : category === BuildingType.Storehouse
              ? nativeResearchConstants.STOREROOM_LEVEL
              : category === BuildingType.SupplyYard
                ? nativeResearchConstants.SUPPLY_YARD_LEVEL
                : 0;
  if (realm.base.level < minimum) return { level: minimum };
  if (!isOnePerRealm(category)) return "open";
  if (getBuildingQuantity(safeInteger(realm.entity_id), category, store) > 0) return "built";
  return "open";
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
  if (category === BuildingType.ConscriptionCamp)
    return { kind: "research", line: RESEARCH_TREE.conscriptionLine, icon: "troops" };
  if (category === BuildingType.RationsDepot)
    return { kind: "research", line: RESEARCH_TREE.rationsLine, icon: "wheat" };
  const trains = TRAINS[category];
  if (trains) return { kind: "trains", attribute: trains };
  if (category === BuildingType.WorkersHut) return { kind: "population", amount: nextHutGrant(store, realm, learned) };
  if (category === BuildingType.Storehouse)
    return { kind: "stores", shareBps: store.require("BoardRules", { game_id: realm.game_id }).storage_step_bps };
  const resource = getProducedResource(category);
  if (!isProduct(resource)) throw new Error(`Building ${category} makes nothing a Frontier realm stores`);
  const output = buildingOutput(store, realm, category, madePicks(resource, learned));
  return { kind: "produces", resource, perHour: output.total * 3600, output };
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
