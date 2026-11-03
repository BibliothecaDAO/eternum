import {
  canPayTroopRaise,
  configManager,
  entityHomeNamespace,
  expeditionRealmSite,
  getTroopResourceId,
  readExpeditionRules,
  readTroopRaiseCost,
  realmLearned,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  getDirectionBetweenAdjacentHexes,
  RESOURCE_PRECISION,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import { ARMY_MANAGEMENT } from "@/ui/design-system/kit/words";

/** The existing army's home stock, room and raising cost, at the time its command would execute. */
export const readReinforcePlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  explorerId: number,
  amount: number,
  timestamp: number,
) => {
  const gameId = realm.game_id;
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  const position = store.entityOccupancy(gameId, explorerId);
  const rules = readExpeditionRules(store, gameId);
  if (!army || !position || !rules || realmLearned(store, gameId, realm.entity_id) === undefined) return undefined;
  const home = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), timestamp);
  const direction = home && !position.alt ? getDirectionBetweenAdjacentHexes(position, home) : null;
  const besideHome = army.owner === realm.entity_id && !position.alt && home !== null && direction !== null;
  const troop = getTroopResourceId(army.troops.category as TroopType, army.troops.tier as TroopTier);
  const homeId = safeInteger(realm.entity_id);
  const held = new ResourceManager(store, homeId, gameId).balanceWithProduction(timestamp, troop)?.balance;
  const validAmount = Number.isSafeInteger(amount) && amount >= 1;
  const costs = validAmount ? readTroopRaiseCost(store, gameId, homeId, troop, amount, timestamp) : [];
  if (held === undefined || costs === undefined) return undefined;
  const current = Number(army.troops.count / BigInt(RESOURCE_PRECISION));
  const cap = configManager.getMaxArmySize(realm.base.level, army.troops.tier as TroopTier);
  const maximum = Math.max(0, Math.min(Math.floor(Number(held) / RESOURCE_PRECISION), cap - current));
  const reason =
    !besideHome || current === 0
      ? ARMY_MANAGEMENT.homeOnly
      : maximum === 0
        ? current >= cap
          ? ARMY_MANAGEMENT.full
          : ARMY_MANAGEMENT.noStock
        : !validAmount || amount > maximum
          ? ARMY_MANAGEMENT.chooseAmount
          : !canPayTroopRaise(costs)
            ? ARMY_MANAGEMENT.shortCost
            : null;
  return { current, maximum, costs, reason, besideHome, direction };
};
