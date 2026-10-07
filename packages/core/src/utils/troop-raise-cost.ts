import { RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "../managers";

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
 * simple input of the troop's recipe, rounded up; nothing elsewhere. Each cost carries what the structure holds of it
 * now. Undefined while a holding is unknown.
 */
export const readTroopRaiseCost = (
  store: NativeFactStore,
  gameId: number,
  structureId: number,
  troopResource: ResourcesIds,
  troops: number,
  tick: number,
): TroopRaiseCost[] | undefined => {
  if (!store.get("BoardRules", { game_id: gameId })) return [];
  const recipe = store.require("ProductionRecipe", { game_id: gameId, resource_type: troopResource });
  if (recipe.simple_output === 0n) throw new Error(`Troop ${troopResource} has no recipe to deploy from`);
  const deployed = BigInt(troops) * BigInt(RESOURCE_PRECISION);
  const manager = new ResourceManager(store, structureId, gameId);
  const costs: TroopRaiseCost[] = [];
  for (const input of recipe.simple_inputs) {
    const held = manager.balanceWithProduction(tick, input.resource_type)?.balance;
    if (held === undefined) return undefined;
    costs.push({
      resource: input.resource_type,
      amount: (input.amount * deployed + recipe.simple_output - 1n) / recipe.simple_output,
      held: BigInt(held),
    });
  }
  return costs;
};

/** Whether the structure holds every cost; unknown costs cannot be paid yet. */
export const canPayTroopRaise = (costs: TroopRaiseCost[] | undefined): boolean =>
  costs !== undefined && costs.every(({ amount, held }) => held >= amount);
