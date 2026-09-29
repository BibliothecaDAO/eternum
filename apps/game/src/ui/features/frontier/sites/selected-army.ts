import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { configManager, entityMapPosition, isViewerOwner } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

const ARMY_MODELS = ["ExplorerTroops", "Structure", "TileOccupancy"] as const;

/** The army the player has selected, where it stands, when it is theirs and orders are allowed: a site's actor. */
export const useSelectedOwnArmy = (): {
  army: NativeRows["ExplorerTroops"];
  armyTile: { col: number; row: number; alt: boolean };
} | null => {
  const { setup } = useGame();
  const viewer = useAccountAddress();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(ARMY_MODELS);
  if (!ordersAllowed || selectedId === null) return null;
  const gameId = configManager.getActiveGameId();
  const army = setup.store.get("ExplorerTroops", { game_id: gameId, explorer_id: Number(selectedId) });
  if (!army) return null;
  const home = setup.store.get("Structure", { game_id: gameId, entity_id: army.owner });
  if (!home || !isViewerOwner(home.owner, viewer)) return null;
  const position = entityMapPosition(setup.store, gameId, army.explorer_id);
  return { army, armyTile: { col: position.x, row: position.y, alt: position.alt } };
};
