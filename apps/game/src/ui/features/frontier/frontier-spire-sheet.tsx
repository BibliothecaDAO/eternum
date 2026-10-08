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
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { SpireDepthActions } from "./spire-depth-actions";

/** Rule-drawn spires have no occupancy row, so select them from the same rules as the map. */
export const FrontierSpireSheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const {
    setup: { store },
  } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedHex);
  const selectedArmy = useUIStore((state) => state.entityActions.selectedEntityId);
  const ordersAllowed = useUIStore(canIssueOrders);
  const address = useAccountStore((state) => state.account?.address);
  useNativeRevision(["ArmySlot", "ExplorerTroops", "TileOccupancy", "RealmKnowledge"]);
  const rules = readExpeditionRules(store, realm.game_id);
  const now = getBlockTimestamp().currentBlockTimestamp;
  if (!isMapView || !ordersAllowed || !address || BigInt(address) !== realm.owner || !rules || now < rules.startMainAt)
    return null;
  if (!researchedDepth(store, realm.game_id, realm.entity_id)) return null;
  const spire = expeditionSpireTile(rules, realm, now);
  if (!spire) return null;
  const spireSelected = selected?.col === spire.col && selected?.row === spire.row;
  const army = liveHomeArmies(store, realm.entity_id, realm.game_id).find(
    (army) =>
      (spireSelected || army.explorer_id === selectedArmy) &&
      isAtExpeditionSpire(spire, entityMapPosition(store, realm.game_id, army.explorer_id)),
  );
  if (!army) return null;
  return (
    <Sheet
      label="Spire"
      onClose={() => {
        useUIStore.getState().updateEntityActionSelectedEntityId(null);
        onClose();
      }}
    >
      <SpireDepthActions armyEntityId={army.explorer_id} />
    </Sheet>
  );
};
