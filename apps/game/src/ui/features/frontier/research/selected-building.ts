import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import type { TypeRowView } from "./research-plan";
import { useResearchPlan } from "./research-reader";

/**
 * The standing building of the player's realm they tapped in the realm view, as its type's research row, with the
 * Essence the realm holds: one Upgrade sheet whichever way the player came, the board or the castle's tree.
 */
export const useSelectedBuildingRow = (
  realm: NativeRows["Structure"] | null,
): { view: TypeRowView; essence: number | undefined } | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  const plan = useResearchPlan(realm);
  useNativeRevision(["Building"]);
  if (isMapView || !ordersAllowed || !realm || !plan || !selected || selected.structureId !== realm.entity_id)
    return null;
  const building = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: selected.innerCol,
    inner_row: selected.innerRow,
  });
  const view = building && plan.types.find(({ category }) => category === Number(building.category));
  return view ? { view, essence: plan.essence } : null;
};
