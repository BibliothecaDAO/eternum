import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType } from "@bibliothecadao/types";

/** A standing building the player tapped in their realm's view: its type and its plot. */
export interface TappedBuilding {
  category: BuildingType;
  innerCol: number;
  innerRow: number;
}

/**
 * The standing building the player tapped in their realm's view: Research opens on its row, and the building stands
 * over that page with Demolish. None for the keep (it has its own sheet), an empty plot, another realm, the map, or a
 * viewer.
 */
export const useTappedBuilding = (realm: NativeRows["Structure"] | null): TappedBuilding | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Building"]);
  if (isMapView || !ordersAllowed || !realm || !selected || selected.structureId !== safeInteger(realm.entity_id))
    return null;
  if (selected.innerCol === BUILDINGS_CENTER[0] && selected.innerRow === BUILDINGS_CENTER[1]) return null;
  const building = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: selected.innerCol,
    inner_row: selected.innerRow,
  });
  const category = building ? Number(building.category) : BuildingType.None;
  return category === BuildingType.None ? null : { category, innerCol: selected.innerCol, innerRow: selected.innerRow };
};

/**
 * Whether the building a tap kept still stands on its plot, as it was: false once it is demolished or replaced, so
 * what the tap opened for it goes with it.
 */
export const useStillStands = (realm: NativeRows["Structure"], building: TappedBuilding): boolean => {
  const { setup } = useGame();
  useNativeRevision(["Building"]);
  const standing = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: building.innerCol,
    inner_row: building.innerRow,
  });
  return standing !== undefined && Number(standing.category) === building.category;
};
