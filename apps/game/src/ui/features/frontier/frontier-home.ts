import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getTroopResourceId,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { type ID, TroopTier, TroopType } from "@bibliothecadao/types";
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

/** Frontier's two places: `goToPlace(true)` opens the day's expedition map, `goToPlace(false)` the realm board. */
export const useGoToFrontierPlace = (realm: NativeRows["Structure"]) => {
  const { setup } = useGame();
  const goToStructure = useGoToStructure(setup);
  return (expedition: boolean) => {
    const position = Position.fromContract(structureMapPosition(setup.store, realm));
    void goToStructure(realm.entity_id, position, expedition);
  };
};

const TROOP_RESOURCE_IDS = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin].flatMap((type) =>
  [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => getTroopResourceId(type, tier)),
);

/** Whole troops waiting at the realm across every type and tier; unknown while any troop balance is. */
export const troopsOnHand = (store: NativeFactStore, realmId: ID, tick: number): number | undefined => {
  let total = 0;
  for (const resourceId of TROOP_RESOURCE_IDS) {
    const balance = getBalance(realmId, resourceId, tick, store).balance;
    if (balance === undefined) return undefined;
    total += divideByPrecision(Number(balance));
  }
  return total;
};

/** Whether an army is the player's: its home realm is theirs. */
export const isPlayersArmy = (
  store: Pick<NativeFactStore, "get">,
  army: { game_id: number; explorer_id: number },
  player: string,
): boolean => {
  const explorer = store.get("ExplorerTroops", army);
  const home = explorer && store.get("Structure", { game_id: army.game_id, entity_id: explorer.owner });
  return home !== undefined && BigInt(home.owner) === BigInt(player);
};
