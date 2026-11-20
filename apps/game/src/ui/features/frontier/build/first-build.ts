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

/**
 * The options a build sheet offers: all of them once the first Barracks has opened the list, and until then the Barracks
 * alone, but only while it can be raised now (open, with free population for it). A realm that cannot raise it keeps
 * every option, so the way out (a Hut for room) stays reachable whatever progress the account holds.
 */
export function disclosedBuildOptions<
  Option extends { category: BuildingType; standing: unknown; populationCost: number },
>(options: Option[] | undefined, listOpen: boolean, freePopulation: number | undefined): Option[] | undefined {
  if (listOpen || !options) return options;
  const barracks = options.find(({ category }) => category === FIRST_BUILD);
  const raisable =
    barracks?.standing === "open" && freePopulation !== undefined && freePopulation >= barracks.populationCost;
  return barracks && raisable ? [barracks] : options;
}
