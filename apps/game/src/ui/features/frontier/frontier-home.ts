import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  configManager,
  isArmyCurrent,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { useMemo } from "react";

const RULE_MODELS = ["SliceRules", "SettlementRules", "GameRegistry"] as const;
const HOME_MODELS = ["Structure"] as const;

/** The expedition rules as a subscription: non-null exactly when this game is Frontier. */
export const useExpeditionRules = () => {
  const facts = useNativeFacts(RULE_MODELS);
  return useMemo(() => readExpeditionRules(facts.store, configManager.getActiveGameId()), [facts]);
};

/** The signed-in player's expedition realm, or null for a spectator or before the realm is founded. */
export const useFrontierRealm = (): NativeRows["Structure"] | null => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const facts = useNativeFacts(HOME_MODELS);
  return useMemo(() => {
    if (!address) return null;
    const owned = facts.store.structuresOwnedBy(configManager.getActiveGameId(), BigInt(address));
    return [...owned].find((structure) => isExpeditionRealm(facts.store, structure)) ?? null;
  }, [address, facts]);
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
    void goToStructure(safeInteger(realm.entity_id), position, expedition);
  };
};

/** The realm's armies the day has ended: still at home in the facts, allocated on an earlier day. */
export const endedHomeArmies = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  now: number,
): NativeRows["ExplorerTroops"][] =>
  [...store.armiesAtHome(realm.game_id, realm.entity_id)].filter(
    (army) => army.troops.count > 0n && !isArmyCurrent(store, realm.game_id, army.explorer_id, now),
  );
