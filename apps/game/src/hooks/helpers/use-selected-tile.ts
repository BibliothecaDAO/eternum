import { useQuery } from "./use-query";
import { useUIStore } from "../store/use-ui-store";

/** Only the active scene owns the inspector; the other scene may retain a selection for returning to it. */
export function useSelectedTile() {
  const { isMapView } = useQuery();
  const world = useUIStore((state) => state.selectedHex);
  const local = useUIStore((state) => state.selectedBuildingHex);
  return isMapView
    ? world && { scene: "world" as const, hex: world }
    : local && { scene: "local" as const, hex: local };
}
