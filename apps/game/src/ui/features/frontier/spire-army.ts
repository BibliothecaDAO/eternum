import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  entityMapPosition,
  expeditionSpireTile,
  getBlockTimestamp,
  isAtExpeditionSpire,
  liveHomeArmies,
  readExpeditionRules,
  researchedDepth,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { canIssueOrders } from "@/utils/can-issue-orders";

/**
 * The player's army standing at their realm's spire that the selection picks (the spire's tile, or the army itself),
 * once the realm has researched a depth; null otherwise. Rule-drawn spires have no occupancy row, so the spire is found
 * from the same rules as the map.
 */
export const useSpireArmy = (realm: NativeRows["Structure"] | null): number | null => {
  const {
    setup: { store },
  } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedHex);
  const selectedArmy = useUIStore((state) => state.entityActions.selectedEntityId);
  const ordersAllowed = useUIStore(canIssueOrders);
  const address = useAccountStore((state) => state.account?.address);
  useNativeRevision(["ArmySlot", "ExplorerTroops", "TileOccupancy", "RealmKnowledge"]);
  if (!realm || !isMapView || !ordersAllowed || !address || BigInt(address) !== realm.owner) return null;
  const rules = readExpeditionRules(store, realm.game_id);
  const now = getBlockTimestamp().currentBlockTimestamp;
  if (!rules || now < rules.startMainAt || !researchedDepth(store, realm.game_id, realm.entity_id)) return null;
  const spire = expeditionSpireTile(rules, realm, now);
  if (!spire) return null;
  const spireSelected = selected?.col === spire.col && selected?.row === spire.row;
  const army = liveHomeArmies(store, safeInteger(realm.entity_id), realm.game_id).find(
    (army) =>
      (spireSelected || safeInteger(army.explorer_id) === selectedArmy) &&
      isAtExpeditionSpire(spire, entityMapPosition(store, realm.game_id, army.explorer_id)),
  );
  return army ? safeInteger(army.explorer_id) : null;
};
