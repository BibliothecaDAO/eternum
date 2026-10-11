import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";
import { realmLearned, researchChoice, researchTier } from "./realm-research";

/** The contract's refusal when a structure cannot pay what deploying troops costs it. */
export const TROOP_RAISE_SHORT_REASON = "Realm cannot pay to raise troops.";

export interface TroopRaiseCost {
  resource: ResourcesIds;
  /** What deploying the troops takes, in resource precision. */
  amount: bigint;
  /** What the structure holds of it now, production settled, in resource precision. */
  held: bigint;
}

/**
 * What a structure pays, beyond the troops themselves, to deploy `troops` whole troops of `troopResource` into a new
 * army, an army it reinforces or a guard, as the contract's raise_troops charges: on a game with a building board, each
 * simple input of the troop's recipe, rounded up, its wheat cut by each Rations pick; nothing elsewhere. Each cost
 * carries what the structure holds of it now. Undefined while a holding is unknown.
 */
export const readTroopRaiseCost = (
  store: NativeFactStore,
  gameId: number,
  structureId: number,
  troopResource: ResourcesIds,
  troops: number,
  tick: number,
): TroopRaiseCost[] | undefined => {
  const board = store.get("BoardRules", { game_id: gameId });
  if (!board) return [];
  const recipe = store.require("ProductionRecipe", { game_id: gameId, resource_type: troopResource });
  if (recipe.simple_output === 0n) throw new Error(`Troop ${troopResource} has no recipe to deploy from`);
  const deployed = BigInt(troops) * BigInt(RESOURCE_PRECISION);
  const rationCut = rationCutOf(rationPicks(realmLearned(store, gameId, structureId) ?? 0n), board, recipe);
  const manager = new ResourceManager(store, structureId, gameId);
  const costs: TroopRaiseCost[] = [];
  for (const input of recipe.simple_inputs) {
    const held = manager.balanceWithProduction(tick, input.resource_type)?.balance;
    if (held === undefined) return undefined;
    const amount =
      input.resource_type === ResourcesIds.Wheat
        ? input.amount - (rationCut < input.amount ? rationCut : input.amount)
        : input.amount;
    costs.push({
      resource: input.resource_type,
      amount: (amount * deployed + recipe.simple_output - 1n) / recipe.simple_output,
      held: BigInt(held),
    });
  }
  return costs;
};

/** The wheat each Rations pick cuts from a recipe's simple output, as resources_domain.cairo's ration_cut does. */
const rationCutOf = (picks: bigint, board: { ration_step: bigint }, recipe: { simple_output: bigint }): bigint =>
  (picks * board.ration_step * recipe.simple_output) / BigInt(RESOURCE_PRECISION);

/**
 * The wheat one troop of `troopResource` deploys for with `picks` Rations picks on the Barracks row, in whole wheat:
 * the recipe's wheat, less each pick's cut, never below nothing.
 */
export const rationedWheatPerTroop = (
  store: NativeFactStore,
  gameId: number,
  troopResource: ResourcesIds,
  picks: number,
): number => {
  const board = store.require("BoardRules", { game_id: gameId });
  const recipe = store.require("ProductionRecipe", { game_id: gameId, resource_type: troopResource });
  const wheat = recipe.simple_inputs.find(({ resource_type }) => resource_type === ResourcesIds.Wheat)?.amount ?? 0n;
  const cut = rationCutOf(BigInt(picks), board, recipe);
  return Number(wheat - (cut < wheat ? cut : wheat)) / Number(recipe.simple_output);
};

// The Barracks row's Rations picks, as resources_domain.cairo's ration_cut counts them.
const rationPicks = (learned: bigint): bigint => {
  let picks = 0n;
  for (let tier = 1; tier <= researchTier(learned, research.ROW_BARRACKS); tier++)
    if (researchChoice(learned, research.ROW_BARRACKS, tier) === research.CHOICE_RATIONS) picks++;
  return picks;
};

/** Whether the structure holds every cost; unknown costs cannot be paid yet. */
export const canPayTroopRaise = (costs: TroopRaiseCost[] | undefined): boolean =>
  costs !== undefined && costs.every(({ amount, held }) => held >= amount);
