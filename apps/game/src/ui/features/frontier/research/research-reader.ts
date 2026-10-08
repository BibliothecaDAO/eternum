import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { knownBalance } from "@/ui/utils/utils";
import {
  getBalance,
  getBuildingQuantity,
  realmLearned,
  researchRowCategory,
  researchTier,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import type { ResearchNodeView, ResearchPlan, TypeRowView } from "./research-plan";

const RESEARCH_MODELS = [
  "RealmKnowledge",
  "ResearchPrice",
  "BoardRules",
  "BuildingRule",
  "StructureBuildings",
  "ResourceBalance",
  "ResourceProduction",
] as const;

/** The realm's research tree as its sheet draws it, from its facts; unknown while the realm's knowledge is (or with no realm). */
export const useResearchPlan = (realm: NativeRows["Structure"] | null): ResearchPlan | undefined => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const revision = useNativeRevision(RESEARCH_MODELS);
  return useMemo(
    () => (realm ? readResearchPlan(setup.store, realm, tick) : undefined),
    [realm, revision, setup.store, tick],
  );
};

/**
 * The realm's tree: each building type that stands, with its tier and next price; and each castle row's tier, in row
 * order, learned up to the row's tier, open for its next one, else locked, with its Essence price.
 */
const readResearchPlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): ResearchPlan | undefined => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (learned === undefined) return undefined;
  const prices = [...store.inGame("ResearchPrice", realm.game_id)]
    .filter(({ row, tier }) => drawnEffect(row, tier) !== undefined)
    .toSorted((left, right) => left.row - right.row || left.tier - right.tier);
  return {
    essence: knownBalance(getBalance(realm.entity_id, ResourcesIds.Essence, tick, store).balance),
    types: readTypeRows(store, realm, learned),
    nodes: prices.map(({ row, tier, essence }) => {
      const effect = drawnEffect(row, tier)!;
      const reached = researchTier(learned, row);
      return {
        node: row * 8 + tier,
        row,
        state: tier <= reached ? "learned" : tier === reached + 1 && rowOpen(store, realm, row) ? "open" : "locked",
        price: Number(essence) / RESOURCE_PRECISION,
        effect,
      };
    }),
  };
};

/** The building rows whose type stands on the realm, in row order, each with its next tier's price. */
const readTypeRows = (store: NativeFactStore, realm: NativeRows["Structure"], learned: bigint): TypeRowView[] =>
  BUILDING_ROWS.filter((row) => rowOpen(store, realm, row)).map((row) => {
    const tier = researchTier(learned, row);
    const price = store.get("ResearchPrice", { game_id: realm.game_id, row, tier: tier + 1 });
    return {
      row,
      category: researchRowCategory[row]!,
      tier,
      learned,
      next: price && { essence: wholeUnits(price.essence), labor: wholeUnits(price.labor) },
    };
  });

/** The rows a building type climbs: farm to Hearth. */
const BUILDING_ROWS = [
  research.ROW_FARM,
  research.ROW_WORKSHOP,
  research.ROW_BARRACKS,
  research.ROW_HUT,
  research.ROW_WAR_HALL,
  research.ROW_SUPPLY_YARD,
  research.ROW_SCOUTS_LODGE,
  research.ROW_HEARTH,
] as const;

const wholeUnits = (amount: bigint): number => Number(amount / BigInt(RESOURCE_PRECISION));

/** What the page draws as a castle row: the Shrine and Well, and the three depths. Building rows have their own. */
const drawnEffect = (row: number, tier: number): ResearchNodeView["effect"] | undefined => {
  if (row === research.ROW_SHRINE) return { kind: "site", site: "Shrine" };
  if (row === research.ROW_WELL) return { kind: "site", site: "Well" };
  if (row === research.ROW_DEPTH) return { kind: "depth", depth: tier as 1 | 2 | 3 };
  return undefined;
};

/** A building row opens once a building of its type stands; the castle's own workshop does not count. */
const rowOpen = (store: NativeFactStore, realm: NativeRows["Structure"], row: number): boolean => {
  const category = researchRowCategory[row];
  if (category === undefined) return true;
  const castle = category === BuildingType.ResourceLabor ? 1 : 0;
  return getBuildingQuantity(realm.entity_id, category, store) > castle;
};
