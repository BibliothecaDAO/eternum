import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType } from "@bibliothecadao/types";

/** A standing building tapped on the realm's board: its type and its plot. */
export interface TappedBuilding {
  category: BuildingType;
  innerCol: number;
  innerRow: number;
}

/**
 * The standing building tapped on the board of `realm`, the realm the board draws, whose own card opens: a player's to
 * run, a viewer's to read. None for the keep (it has its own card), an empty plot, another realm, or the map.
 */
export const useTappedBuilding = (realm: NativeRows["Structure"] | null): TappedBuilding | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  useNativeRevision(["Building"]);
  if (isMapView || !realm || !selected || selected.structureId !== safeInteger(realm.entity_id)) return null;
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
