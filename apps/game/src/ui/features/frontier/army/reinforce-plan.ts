import {
  configManager,
  getBalance,
  getTroopResourceId,
  realmLearned,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  type Direction,
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import { troopRange, type TroopRange, wheatToRaise } from "../deploy/deploy-plan";

/**
 * What reinforcing an army from its realm needs, read from facts with no UI of its own: the troops it holds and the
 * most it may hold, the realm's stock of its own troop (the contract's recruit_explorer draws that stock and no other,
 * and credits no Homecoming), and the wheat each troop costs to raise against the wheat the realm holds.
 */
export interface ReinforcePlan {
  current: number;
  cap: number;
  stock: number;
  wheatPerTroop: number;
  wheat: number;
}

const PRECISION = BigInt(RESOURCE_PRECISION);

/** The army's reinforcement from its realm today; unknown while its troops, a balance or the realm's research is. */
export const readReinforcePlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  explorerId: number,
  defaultTick: number,
): ReinforcePlan | undefined => {
  const army = store.get("ExplorerTroops", { game_id: realm.game_id, explorer_id: explorerId });
  // A troop's price waits on the realm's research: the Barracks' Rations lowers it.
  if (!army || realmLearned(store, realm.game_id, realm.entity_id) === undefined) return undefined;
  const troops = { type: army.troops.category as TroopType, tier: army.troops.tier as TroopTier };
  const realmId = safeInteger(realm.entity_id);
  const stock = getBalance(realmId, getTroopResourceId(troops.type, troops.tier), defaultTick, store).balance;
  const wheat = getBalance(realmId, ResourcesIds.Wheat, defaultTick, store).balance;
  if (stock === undefined || wheat === undefined) return undefined;
  return {
    current: Number(army.troops.count / PRECISION),
    cap: configManager.getMaxArmySize(realm.base.level, troops.tier),
    stock: Number(BigInt(stock) / PRECISION),
    wheatPerTroop: wheatToRaise(store, realm, troops, 1, defaultTick),
    wheat: Number(BigInt(wheat) / PRECISION),
  };
};

/** The most the army can take: the realm's stock, the room under its cap and the wheat, whichever runs out first. */
export const reinforceRange = (plan: ReinforcePlan): TroopRange =>
  troopRange(Math.max(0, Math.min(plan.stock, plan.cap - plan.current)), plan);

/**
 * Where the army stands against its realm's home today: the direction from it to the home when it stands on a tile
 * beside it on the surface, the one place the contract reinforces it; null anywhere else or while unknown.
 */
export const homeDirectionOf = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  explorerId: number,
): Direction | null => {
  const army = store.entityOccupancy(realm.game_id, explorerId);
  const home = structureMapPosition(store, realm);
  if (!army || army.alt || !home || home.alt) return null;
  return getDirectionBetweenAdjacentHexes(army, { col: home.x, row: home.y });
};
