import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { knownAmount } from "@/ui/utils/utils";
import {
  getBalance,
  realmLearned,
  RESEARCH_ROWS,
  researchRowCategory,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import { useMemo } from "react";

import { standingBuildings } from "../production/store-makers";
import { type LearnedRow, readResearchTree, type RealmResearchFacts, type TreeNode } from "./research-tree";

const RESEARCH_MODELS = [
  "RealmKnowledge",
  "ResearchPrice",
  "ResourceRule",
  "ProductionRecipe",
  "BoardRules",
  "BuildingRule",
  "StructureBuildings",
  "ResourceBalance",
  "ResourceProduction",
] as const;

const whole = (amount: bigint): number => Number(amount / BigInt(RESOURCE_PRECISION));

/** A price the tree reads that the store does not hold yet: the tree stays unknown until it arrives. */
class PricePending extends Error {}

/** The realm's tree with the Essence and labor it holds, live; none while its knowledge or balances are unknown. */
export const useResearchTree = (
  realm: NativeRows["Structure"] | null,
): { nodes: TreeNode[]; essence: number; labor: number } | undefined => {
  const tick = useCurrentDefaultTick();
  const facts = useNativeFacts(RESEARCH_MODELS);
  return useMemo(() => {
    const research = realm ? readResearchFacts(facts.store, realm, tick) : undefined;
    if (!research) return undefined;
    try {
      return { nodes: readResearchTree(research), essence: research.essence, labor: research.labor };
    } catch (error) {
      if (error instanceof PricePending) return undefined;
      throw error;
    }
  }, [realm, facts, tick]);
};

/**
 * What the tree reads of a realm and its game, from the store; none while any of it is not known yet. Prices are read
 * as the tree asks for them, so a missing one stops the reading (PricePending) rather than defaulting.
 */
const readResearchFacts = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): RealmResearchFacts | undefined => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  const entity = safeInteger(realm.entity_id);
  const essence = knownAmount(getBalance(entity, ResourcesIds.Essence, tick, store).balance);
  const labor = knownAmount(getBalance(entity, ResourcesIds.Labor, tick, store).balance);

  const board = store.get("BoardRules", { game_id: realm.game_id });
  if (learned === undefined || essence === undefined || labor === undefined || !board) return undefined;
  const recipe = store.require("ProductionRecipe", { game_id: realm.game_id, resource_type: ResourcesIds.Knight });
  const wheat = recipe.simple_inputs.find((input) => input.resource_type === ResourcesIds.Wheat);
  if (!wheat || recipe.simple_output === 0n) throw new Error("Missing troop wheat recipe");
  const rows = decodeLearned(learned);
  const storerooms = standingBuildings(store, entity, research.STOREROOM);
  return {
    castleLevel: realm.base.level,
    essence,
    labor,
    standing: standingByRow(store, entity),
    learned: rows,
    price: (row, tier) => {
      const price = store.get("ResearchPrice", { game_id: realm.game_id, row, tier });
      if (!price) throw new PricePending(`ResearchPrice row ${row} tier ${tier}`);
      return { essence: whole(price.essence), labor: whole(price.labor) };
    },
    board: {
      outputStepBps: board.output_step_bps,
      rationStep: Number(board.ration_step) / RESOURCE_PRECISION,
      wheatPerTroop: Number(wheat.amount) / Number(recipe.simple_output),
      troopsPerHour: buildingOutput(store, realm, BuildingType.ResourceKnightT1, 0).base * 3600,
      staminaBar: store.require("SliceRules", { game_id: realm.game_id }).troop_stamina_config.stamina_knight_max,
    },
    laborStore: (level) => {
      const base = ResourceManager.castleStoreLimit(store, realm.game_id, level, ResourcesIds.Labor);
      if (base === undefined) throw new Error(`No castle store at level ${level}`);
      return (whole(base) * (10_000 + storerooms * board.storage_step_bps)) / 10_000;
    },
  };
};

const decodeLearned = (learned: bigint): Partial<Record<number, LearnedRow>> =>
  Object.fromEntries(RESEARCH_ROWS.map((row) => [row, { tier: researchTier(learned, row) }]));

/** The buildings standing of each building row's type (standingBuildings: the castle's labor is no Workshop). */
const standingByRow = (store: NativeFactStore, entity: number): Partial<Record<number, number>> =>
  Object.fromEntries(
    Object.entries(researchRowCategory).map(([row, category]) => [
      Number(row),
      standingBuildings(store, entity, category!),
    ]),
  );
