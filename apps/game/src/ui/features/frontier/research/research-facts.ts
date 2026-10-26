import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { knownAmount } from "@/ui/utils/utils";
import {
  getBalance,
  rationedWheatPerTroop,
  realmLearned,
  researchChoice,
  researchRowCategory,
  researchTier,
  ResourceManager,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  nativeRuleConstants,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

import { standingBuildings } from "../production/store-makers";
import { type LearnedRow, readResearchTree, type RealmResearchFacts, type TreeNode } from "./research-tree";

const RESEARCH_MODELS = [
  "RealmKnowledge",
  "ResearchPrice",
  "BoardRules",
  "BuildingRule",
  "StructureBuildings",
  "ResourceBalance",
  "ResourceProduction",
  "ArmyProgressionRules",
] as const;

/** The rows whose tiers each pick a side (or the lodge's kind). */
const CHOOSING_ROWS = new Set<number>([
  research.ROW_FARM,
  research.ROW_WORKSHOP,
  research.ROW_BARRACKS,
  research.ROW_SCOUTS_LODGE,
]);

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
  // The tree stays unknown until the realm's knowledge, its balances and the game's board and XP rules are all in.
  const board = store.get("BoardRules", { game_id: realm.game_id });
  const xpRules = store.get("ArmyProgressionRules", { game_id: realm.game_id });
  if (learned === undefined || essence === undefined || labor === undefined || !board || !xpRules) return undefined;
  const rows = decodeLearned(learned);
  const storeroomPicks = (rows[research.ROW_WORKSHOP]?.sides ?? []).filter((side) => side === 1).length;
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
      storageStepBps: board.storage_step_bps,
      populationStepBps: board.population_step_bps,
      trainingGateTier: board.training_gate_tier,
    },
    laborStore: (level) => {
      const base = ResourceManager.castleStoreLimit(store, realm.game_id, level);
      if (base === undefined) throw new Error(`No castle store at level ${level}`);
      return (whole(base) * (10_000 + storeroomPicks * board.storage_step_bps)) / 10_000;
    },
    wheatPerTroop: (rations) => rationedWheatPerTroop(store, realm.game_id, ResourcesIds.Knight, rations),
    shrineXp: xpRules.fixed_xp,
    wellStamina: nativeRuleConstants.WELL_STAMINA,
  };
};

/** Every row's tier and the side taken at each tier, as RealmKnowledge packs them. */
const decodeLearned = (learned: bigint): Partial<Record<number, LearnedRow>> =>
  Object.fromEntries(
    Array.from({ length: research.ROW_COUNT }, (_, row) => {
      const tier = researchTier(learned, row);
      const sides = CHOOSING_ROWS.has(row)
        ? Array.from({ length: tier }, (_, index) => researchChoice(learned, row, index + 1))
        : [];
      return [row, { tier, sides }];
    }),
  );

/** The buildings standing of each building row's type (standingBuildings: the castle's labor is no Workshop). */
const standingByRow = (store: NativeFactStore, entity: number): Partial<Record<number, number>> =>
  Object.fromEntries(
    Object.entries(researchRowCategory).map(([row, category]) => [
      Number(row),
      standingBuildings(store, entity, category!),
    ]),
  );
