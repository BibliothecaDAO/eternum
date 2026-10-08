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
import type { ResearchNodeView, ResearchPlan } from "./research-plan";

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
 * Each priced tier the sheet draws, in row order: learned up to the row's tier, open for the row's next tier once a
 * building of its type stands, else locked; and its Essence price.
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

/**
 * What the sheet draws for a row's tier: a building type's uncommon and rare tiers (its II and III), the Shrine and
 * Well, and the three depths. Other tiers have no medallion yet.
 */
const drawnEffect = (row: number, tier: number): ResearchNodeView["effect"] | undefined => {
  if (row === research.ROW_SHRINE) return { kind: "site", site: "Shrine" };
  if (row === research.ROW_WELL) return { kind: "site", site: "Well" };
  if (row === research.ROW_DEPTH) return { kind: "depth", depth: tier as 1 | 2 | 3 };
  const category = researchRowCategory[row];
  return category === undefined || tier > 2 ? undefined : { kind: "tier", category, tier: (tier + 1) as 2 | 3 };
};

/** A building row opens once a building of its type stands; the castle's own workshop does not count. */
const rowOpen = (store: NativeFactStore, realm: NativeRows["Structure"], row: number): boolean => {
  const category = researchRowCategory[row];
  if (category === undefined) return true;
  const castle = category === BuildingType.ResourceLabor ? 1 : 0;
  return getBuildingQuantity(realm.entity_id, category, store) > castle;
};
