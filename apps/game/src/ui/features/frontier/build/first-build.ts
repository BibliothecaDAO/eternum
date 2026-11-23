import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBuildingQuantity } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";
import { useEffect } from "react";

/** The building a realm raises first: the Barracks. */
export const FIRST_BUILD = BuildingType.ResourceKnightT1;
const BUILDING_MODELS = ["StructureBuildings"] as const;

/**
 * A Frontier realm's first build (the owner's pick F3, 4 November 2026): the Barracks, which trains its armies, while the
 * realm has none. The realm's board lights a plot for it and the build sheet opens on it; none once it stands.
 */
export const useFirstBuild = (realm: NativeRows["Structure"] | null): BuildingType | null => {
  const { setup } = useGame();
  useNativeRevision(BUILDING_MODELS);
  if (!realm) return null;
  return getBuildingQuantity(safeInteger(realm.entity_id), FIRST_BUILD, setup.store) > 0 ? null : FIRST_BUILD;
};

/** Names the first build to the realm's board and the build sheet; none once the HUD leaves. */
export const useMarkFirstBuild = (building: BuildingType | null) => {
  const setFirstBuild = useUIStore((state) => state.setFirstBuild);
  useEffect(() => {
    setFirstBuild(building);
    return () => setFirstBuild(null);
  }, [building, setFirstBuild]);
};

export function disclosedBuildOptions<Option extends { category: BuildingType; standing: unknown }>(
  options: Option[] | undefined,
  listOpen: boolean,
): Option[] | undefined {
  if (listOpen || !options) return options;
  const barracks = options.find(({ category }) => category === FIRST_BUILD);
  return barracks?.standing === "open" ? [barracks] : options;
}
