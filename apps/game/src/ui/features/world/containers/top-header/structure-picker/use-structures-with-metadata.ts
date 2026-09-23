import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useFactView } from "@/hooks/use-fact-view";
import { buildingTilesView } from "@/sync/fact-views";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import {
  countOccupiedBuildingTilesByStructure,
  resolveAvailableBuildingTiles,
} from "@/ui/features/world/containers/structure-status";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { configManager, getBuildingCount, getGuardsByStructure } from "@bibliothecadao/eternum";
import {
  BuildingType,
  ContractAddress,
  getLevelName,
  RealmLevels,
  type Structure,
  StructureType,
} from "@bibliothecadao/types";
import { useMemo } from "react";
import type { StructureWithMetadata } from "./chip";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";

const readPackedCount = (value: bigint | number | string | undefined): bigint => {
  if (value === undefined || value === null) return 0n;
  return BigInt(value);
};

interface UseStructuresWithMetadataArgs {
  structures: Structure[];
  store: NativeFactStore;
  /**
   * Local rename version counter. Bump to force re-derivation when a name
   * changes in localStorage without an underlying chain event.
   */
  nameUpdateVersion?: number;
}

/**
 * Derives `StructureWithMetadata[]` from the raw playerStructures list. Same
 * shape and ordering rules as the legacy in-sidebar computation — moved here
 * so the top-zone picker pills and popover can call it independently.
 */
export const useStructuresWithMetadata = ({
  structures,
  store,
  nameUpdateVersion = 0,
}: UseStructuresWithMetadataArgs): StructureWithMetadata[] => {
  const mode = useGameModeConfig();
  const revision = useNativeRevision(["StructureBuildings", "Guard"]);
  const { favorites } = useFavoriteStructures();
  const { structureGroups } = useStructureGroups();

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const structureTileStatIds = useMemo(
    () =>
      structures
        .filter((structure) => resolveStructureUiCapabilities(structure.structure).hasPopulationDetails)
        .map((structure) => Number(structure.entityId))
        .filter((entityId) => Number.isFinite(entityId))
        .toSorted((left, right) => left - right),
    [structures],
  );
  const trackedStructureIds = useMemo(() => new Set(structureTileStatIds), [structureTileStatIds]);
  // Every building tile of the game is read when one changes; the picker only counts the tracked ones.
  const buildings = useFactView(buildingTilesView);
  const buildingTileCountsByStructure = useMemo(
    () => countOccupiedBuildingTilesByStructure({ trackedStructureIds, buildings }),
    [buildings, trackedStructureIds],
  );

  return useMemo<StructureWithMetadata[]>(() => {
    // Touch the version counter so a localStorage-only rename forces recomputation.
    void nameUpdateVersion;
    const basePopulationCapacityValue = configManager.getBasePopulationCapacity();
    const maxRealmLevel = configManager.getMaxLevel(StructureType.Realm);
    return structures.map((structure) => {
      const { name, originalName } = mode.structure.getName(structure.structure);
      const structureCapabilities = resolveStructureUiCapabilities(structure.structure);
      const baseLevel = structure.structure.base?.level;
      const normalizedLevel =
        typeof baseLevel === "number" ? baseLevel : typeof baseLevel === "bigint" ? Number(baseLevel) : 0;
      const realmLevelLabel = structureCapabilities.hasPopulationDetails
        ? getLevelName(Math.min(Math.max(normalizedLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels)
        : null;
      const structureBuildings = store.get("StructureBuildings", {
        game_id: configManager.getActiveGameId(),
        entity_id: structure.entityId,
      });
      const population = Number(structureBuildings?.population.current ?? 0);
      const normalizedBasePopulationCapacity = structureCapabilities.hasPopulationDetails
        ? Math.max(Number(basePopulationCapacityValue ?? 0), 6)
        : 0;
      const populationCapacity = Number(structureBuildings?.population.max ?? 0) + normalizedBasePopulationCapacity;
      const occupiedBuildingTiles = buildingTileCountsByStructure[structure.entityId];
      const buildingTileSummary =
        structureCapabilities.hasPopulationDetails && occupiedBuildingTiles !== undefined
          ? resolveAvailableBuildingTiles({
              level: normalizedLevel,
              occupiedBuildingTiles,
            })
          : null;
      const groupColor = structureGroups[structure.entityId] ?? null;
      const isFavorite = favoritesSet.has(structure.entityId);

      const packedCounts: bigint[] = [
        readPackedCount(structureBuildings?.packed_counts_1),
        readPackedCount(structureBuildings?.packed_counts_2),
        readPackedCount(structureBuildings?.packed_counts_3),
      ];

      const buildingCounts = {
        wheat: getBuildingCount(BuildingType.ResourceWheat, packedCounts),
        wood: getBuildingCount(BuildingType.ResourceWood, packedCounts),
        coal: getBuildingCount(BuildingType.ResourceCoal, packedCounts),
        copper: getBuildingCount(BuildingType.ResourceCopper, packedCounts),
        market: getBuildingCount(BuildingType.ResourceDonkey, packedCounts),
        workerHut: getBuildingCount(BuildingType.WorkersHut, packedCounts),
        crossbowmanT1: getBuildingCount(BuildingType.ResourceCrossbowmanT1, packedCounts),
        knightT1: getBuildingCount(BuildingType.ResourceKnightT1, packedCounts),
        paladinT1: getBuildingCount(BuildingType.ResourcePaladinT1, packedCounts),
      };

      return {
        ...structure,
        displayName: name,
        originalName,
        realmLevel: normalizedLevel,
        realmLevelLabel,
        population,
        guardCount: getGuardsByStructure(structure.structure, store).filter((guard) => guard.troops.count > 0n).length,
        populationCapacity,
        buildingTilesOccupied: buildingTileSummary?.occupied ?? null,
        buildingTilesTotal: buildingTileSummary?.total ?? null,
        groupColor,
        isFavorite,
        canUpgrade: structure.category === StructureType.Realm && normalizedLevel < maxRealmLevel,
        buildingCounts,
      };
    });
  }, [
    structures,
    store,
    revision,
    structureGroups,
    nameUpdateVersion,
    favoritesSet,
    mode,
    buildingTileCountsByStructure,
  ]);
};
