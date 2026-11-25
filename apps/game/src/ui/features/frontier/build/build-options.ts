import {
  buildingCostRise,
  buildingOpensAtLevel,
  isOathResearch,
  isOnePerRealm,
  getBuildingCosts,
  getBuildingQuantity,
  realmLearned,
  researchRowOf,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, FRONTIER_BUILDING_TYPES, getProducedResource, ResourcesIds } from "@bibliothecadao/types";

import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { type BuildingOutput, buildingOutput } from "@/ui/shared/lib/building-output";

import { madePicks } from "../production/store-makers";
import { isTroopStore, madeStoreOf, storeMadeBy, type MadeResource } from "../stores";

/** Each training building and the attribute it trains every new army in. */
const TRAINS: Partial<Record<BuildingType, "Logistics">> = {
  [BuildingType.SupplyYard]: "Logistics",
};

/** What a Frontier building makes: what one of the realm's made stores holds. */
type Product = MadeResource;

const isProduct = (resource: ResourcesIds | undefined): resource is Product => madeStoreOf(resource) !== undefined;

export type BuildEffect =
  | { kind: "produces"; resource: Product; perHour: number; output: BuildingOutput }
  | { kind: "trains"; attribute: "Logistics" }
  | { kind: "stores"; shareBps: number }
  | { kind: "research"; line: string; icon: "troops" | "wheat" };

export type BuildGroup = "economy" | "army" | "unique";

export const buildGroupOf = (category: BuildingType): BuildGroup => {
  if (isOnePerRealm(category)) return "unique";
  const made = storeMadeBy(category);
  if (made === undefined) throw new Error(`Building ${category} repeats but makes no store`);
  return isTroopStore(made) ? "army" : "economy";
};

export interface BuildOption {
  category: BuildingType;
  group: BuildGroup;
  opensAt: number;
  /** Its type's tier, 1 (common) to 5 (legendary): tiers apply to every building of the type. */
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  cost: { resource: number; amount: number }[];
  /** How the price has risen: the copies already standing and what they multiply the base price by (1 with none). */
  rise: { standing: number; times: number };
  effect: BuildEffect;
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
  for (const category of FRONTIER_BUILDING_TYPES) {
    const cost = getBuildingCosts(safeInteger(realm.entity_id), store, category, useSimpleCost);
    if (cost === undefined) return undefined;
    const effect = readBuildingEffect(store, realm, category, learned);
    const change = wheatChange(effect);
    const row = researchRowOf(category);
    options.push({
      category,
      group: buildGroupOf(category),
      opensAt: buildingOpensAtLevel(category),
      tier: (row === undefined
        ? 1
        : Math.max(
            isTraining(category) || isOathResearch(row) ? 1 : 0,
            researchTier(learned, row),
          )) as BuildOption["tier"],
      cost,
      rise: buildingCostRise(safeInteger(realm.entity_id), category, store),
      effect,
      standing: buildingStanding(store, realm, category),
      wheat: { change, after: wheat === undefined ? undefined : wheat + change },
    });
  }
  return options;
};

const isTraining = (category: BuildingType) =>
  Boolean(TRAINS[category]) || category === BuildingType.ConscriptionCamp || category === BuildingType.RationsDepot;

const buildingStanding = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
): BuildOption["standing"] => {
  const minimum = buildingOpensAtLevel(category);
  if (realm.base.level < minimum) return { level: minimum };
  if (!isOnePerRealm(category)) return "open";
  if (getBuildingQuantity(safeInteger(realm.entity_id), category, store) > 0) return "built";
  return "open";
};

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
  if (category === BuildingType.Storehouse)
    return { kind: "stores", shareBps: store.require("BoardRules", { game_id: realm.game_id }).storage_step_bps };
  const resource = getProducedResource(category);
  if (!isProduct(resource)) throw new Error(`Building ${category} makes nothing a Frontier realm stores`);
  const output = buildingOutput(store, realm, category, madePicks(resource, learned));
  return { kind: "produces", resource, perHour: output.total * 3600, output };
};

/** A farm adds its wheat; nothing a building produces consumes any (armies pay theirs when they deploy). */
const wheatChange = (effect: BuildEffect): number =>
  effect.kind === "produces" && effect.resource === ResourcesIds.Wheat ? effect.perHour : 0;
