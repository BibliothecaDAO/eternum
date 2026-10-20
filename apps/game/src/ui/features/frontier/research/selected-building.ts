import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { researchRowOf } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";

/**
 * The research row of the standing building the player tapped in their realm's view: Research opens on it, one panel
 * whichever way the player came, the board or the tree. None for a building without a row, elsewhere, or for a viewer.
 */
export const useSelectedBuildingRow = (realm: NativeRows["Structure"] | null): number | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Building"]);
  if (isMapView || !ordersAllowed || !realm || !selected || selected.structureId !== safeInteger(realm.entity_id))
    return null;
  // The keep stands on the centre plot and has its own sheet.
  if (selected.innerCol === BUILDINGS_CENTER[0] && selected.innerRow === BUILDINGS_CENTER[1]) return null;
  const building = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: selected.innerCol,
    inner_row: selected.innerRow,
  });
  return (building && researchRowOf(Number(building.category))) ?? null;
};
