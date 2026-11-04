import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBuildingQuantity } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";
import { useEffect } from "react";

const BARRACKS = BuildingType.ResourceKnightT1;
const BUILDING_MODELS = ["StructureBuildings"] as const;

/**
 * A Frontier realm's first build (the owner's pick F3, 4 November 2026): the Barracks, which trains its armies, while the
 * realm has none. The realm's board lights a plot for it and the build sheet opens on it; none once it stands.
 */
export const useFirstBuild = (realm: NativeRows["Structure"] | null): BuildingType | null => {
  const { setup } = useGame();
  useNativeRevision(BUILDING_MODELS);
  if (!realm) return null;
  return getBuildingQuantity(safeInteger(realm.entity_id), BARRACKS, setup.store) > 0 ? null : BARRACKS;
};

/** Names the first build to the realm's board and the build sheet; none once the HUD leaves. */
export const useMarkFirstBuild = (building: BuildingType | null) => {
  const setFirstBuild = useUIStore((state) => state.setFirstBuild);
  useEffect(() => {
    setFirstBuild(building);
    return () => setFirstBuild(null);
  }, [building, setFirstBuild]);
};
