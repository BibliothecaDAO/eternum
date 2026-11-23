import {
  configManager,
  getBalance,
  getTroopResourceId,
  realmLearned,
  structureMapPosition,
  isSupplyPost,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import { type March, readTroopRaise, troopRange, type TroopRaise, type TroopRange } from "../deploy/deploy-plan";

export interface ReinforcePlan {
  current: number;
  cap: number;
  stock: number;
  raise: TroopRaise;
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
  const held = getBalance(realmId, getTroopResourceId(troops.type, troops.tier), defaultTick, store).balance;
  if (held === undefined) return undefined;
  const current = Number(army.troops.count / PRECISION);
  const cap = configManager.getMaxArmySize(realm.base.level, troops.tier);
  const stock = Number(BigInt(held) / PRECISION);
  const raise = readTroopRaise(store, realm, troops, roomFor({ current, cap, stock }), defaultTick);
  return raise && { current, cap, stock, raise };
};

/** The most the army can take: the realm's stock, the room under its cap and the wheat, whichever runs out first. */
export const reinforceRange = (plan: ReinforcePlan, march: March): TroopRange =>
  troopRange(roomFor(plan), plan.raise, march);

/** The troops that could go before the wheat: the realm's stock, within the room under the army's cap. */
const roomFor = ({ current, cap, stock }: Pick<ReinforcePlan, "current" | "cap" | "stock">): number =>
  Math.max(0, Math.min(stock, cap - current));

/** The home or current cleared camp beside the army, checked again before sending. */
export const reinforcementSource = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  explorerId: number,
  timestamp: number,
  supplyPost?: number,
): { supplyPost?: number } | null => {
  const army = store.entityOccupancy(realm.game_id, explorerId);
  if (!army || army.alt) return null;
  if (supplyPost !== undefined) {
    const site = store.get("ExpeditionSite", { game_id: realm.game_id, entity_id: supplyPost });
    return site &&
      isSupplyPost(store, site, realm.entity_id, timestamp) &&
      getDirectionBetweenAdjacentHexes(army, site) !== null
      ? { supplyPost }
      : null;
  }
  const home = structureMapPosition(store, realm);
  return home && !home.alt && getDirectionBetweenAdjacentHexes(army, { col: home.x, row: home.y }) !== null ? {} : null;
};
