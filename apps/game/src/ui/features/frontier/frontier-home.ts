import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  configManager,
  divideByPrecision,
  entityMapPosition,
  type ExpeditionRules,
  getBalance,
  getTroopResourceId,
  homecomingReturn,
  isCurrentExpeditionArmy,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
  ResourceManager,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";

const RULE_MODELS = ["SliceRules", "SettlementRules", "GameRegistry"] as const;
const HOME_MODELS = ["Structure"] as const;

/** The expedition rules as a subscription: non-null exactly when this game is Frontier. */
export const useExpeditionRules = () => {
  const { setup } = useGame();
  const revision = useNativeRevision(RULE_MODELS);
  return useMemo(() => readExpeditionRules(setup.store, configManager.getActiveGameId()), [revision, setup.store]);
};

/** The signed-in player's expedition realm, or null for a spectator or before the realm is founded. */
export const useFrontierRealm = (): NativeRows["Structure"] | null => {
  const { setup } = useGame();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const revision = useNativeRevision(HOME_MODELS);
  return useMemo(() => {
    if (!address) return null;
    const owned = setup.store.structuresOwnedBy(configManager.getActiveGameId(), BigInt(address));
    return [...owned].find((structure) => isExpeditionRealm(setup.store, structure)) ?? null;
  }, [address, revision, setup.store]);
};

/**
 * Frontier's two places: `goToPlace(true)` opens the day's expedition map, `goToPlace(false)` the realm board. With no
 * realm (a spectator) there is nowhere to go.
 */
export const useGoToFrontierPlace = (realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const goToStructure = useGoToStructure(setup);
  return (expedition: boolean) => {
    if (!realm) return;
    const site = structureMapPosition(setup.store, realm);
    if (!site) return;
    const position = Position.fromContract(site);
    void goToStructure(realm.entity_id, position, expedition);
  };
};

const TROOP_RESOURCE_IDS = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin].flatMap((type) =>
  [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => getTroopResourceId(type, tier)),
);

/** The realm's armies the day has ended: still at home in the facts, no longer in today's region. */
export const endedHomeArmies = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  now: number,
): NativeRows["ExplorerTroops"][] =>
  [...store.armiesAtHome(realm.game_id, realm.entity_id)].filter(
    (army) =>
      army.troops.count > 0n &&
      !isCurrentExpeditionArmy(rules, entityMapPosition(store, realm.game_id, army.explorer_id), now),
  );

/** One troop stock as the realm's next deploy finds it, in whole troops. */
type StockAtDeploy = { held: number; returning: number; fits: number };

/**
 * Each troop stock as the realm's next deploy finds it: what it holds, what Homecoming returns from the armies whose
 * day has ended (core's homecomingReturn, by each army's own tier), and what of that fits the stock's limit; the
 * contract credits the return at that deploy. Unknown while a balance or an ended army's progress is.
 */
const stocksAtNextDeploy = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  now: number,
  tick: number,
): Map<ResourcesIds, StockAtDeploy> | undefined => {
  const returning = homecomingByStock(store, realm, rules, now);
  if (!returning) return undefined;
  const manager = new ResourceManager(store, realm.entity_id, realm.game_id);
  const stocks = new Map<ResourcesIds, StockAtDeploy>();
  for (const resourceId of TROOP_RESOURCE_IDS) {
    const balance = getBalance(realm.entity_id, resourceId, tick, store).balance;
    if (balance === undefined) return undefined;
    const held = divideByPrecision(Number(balance));
    const back = returning.get(resourceId) ?? 0;
    const limit = manager.storeLimit(resourceId);
    const room = limit === undefined ? back : Math.max(0, Number(limit / BigInt(RESOURCE_PRECISION)) - held);
    stocks.set(resourceId, { held, returning: back, fits: Math.min(back, room) });
  }
  return stocks;
};

/** Whole troops each ended army sends home, summed by the stock it returns to; unknown while a progress row is. */
const homecomingByStock = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  now: number,
): Map<ResourcesIds, number> | undefined => {
  const returning = new Map<ResourcesIds, number>();
  for (const army of endedHomeArmies(store, realm, rules, now)) {
    const progress = store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
    if (!progress) return undefined;
    const stock = getTroopResourceId(army.troops.category as TroopType, army.troops.tier as TroopTier);
    const whole = Number(army.troops.count / BigInt(RESOURCE_PRECISION));
    returning.set(stock, (returning.get(stock) ?? 0) + homecomingReturn(whole, progress.homecoming));
  }
  return returning;
};

/** Whole troops at home across every stock as the next deploy finds them; unknown while any stock is. */
export const troopsAtHome = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  now: number,
  tick: number,
): number | undefined => {
  const stocks = stocksAtNextDeploy(store, realm, rules, now, tick);
  return stocks && [...stocks.values()].reduce((sum, stock) => sum + stock.held + stock.fits, 0);
};
