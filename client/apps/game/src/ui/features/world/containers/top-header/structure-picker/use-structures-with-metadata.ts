import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { useStructureGroups } from "@/ui/features/world/containers/top-header/structure-groups";
import {
  countOccupiedBuildingTilesByStructure,
  resolveAvailableBuildingTiles,
} from "@/ui/features/world/containers/structure-status";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { configManager, getBuildingCount } from "@bibliothecadao/eternum";
import {
  BuildingType,
  type ClientComponents,
  ContractAddress,
  getLevelName,
  RealmLevels,
  type Structure,
  StructureType,
} from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import type { StructureWithMetadata } from "./chip";

const readPackedCount = (value: bigint | number | string | undefined): bigint => {
  if (value === undefined || value === null) return 0n;
  return BigInt(value);
};

interface UseStructuresWithMetadataArgs {
  structures: Structure[];
  components: ClientComponents;
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
  components,
  nameUpdateVersion = 0,
}: UseStructuresWithMetadataArgs): StructureWithMetadata[] => {
  const mode = useGameModeConfig();
  const { favorites } = useFavoriteStructures();
  const { structureGroups } = useStructureGroups();

  // Inputs needed to compute `canProvision` per structure cheaply. All values
  // are already available in store / RECS — no new torii calls.
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const devModeOn = useUIStore((state) => state.devModeOn);
  const ownerAddress = useAccountStore((state) => state.account?.address ?? null);
  const ownerContract = useMemo(
    () => (ownerAddress ? ContractAddress(ownerAddress) : null),
    [ownerAddress],
  );
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  // dev_mode (sandbox) bypasses the chain's main-phase + season-end gates.
  const isMainPhase =
    devModeOn || (typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt);
  const isSeasonOver = !devModeOn && typeof gameEndAt === "number" && currentBlockTimestamp > gameEndAt;

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
  const buildingEntities = useEntityQuery([Has(components.Building)]);
  const buildingTileCountsByStructure = useMemo(
    () =>
      countOccupiedBuildingTilesByStructure({
        trackedStructureIds,
        buildings: Array.from(buildingEntities)
          .map((entity) => getComponentValue(components.Building, entity))
          .flatMap((building) => {
            if (!building) return [];
            return [
              {
                outerEntityId: Number(building.outer_entity_id ?? 0),
                innerCol: Number(building.inner_col ?? 0),
                innerRow: Number(building.inner_row ?? 0),
              },
            ];
          }),
      }),
    [buildingEntities, components.Building, trackedStructureIds],
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
      const structureEntity = getEntityIdFromKeys([BigInt(structure.entityId)]);
      const structureBuildings = components.StructureBuildings
        ? getComponentValue(components.StructureBuildings, structureEntity)
        : null;
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
        workerHut: getBuildingCount(BuildingType.WorkersHut, packedCounts),
      };

      // canProvision mirrors useBlitzRealmProvision but reads only RECS-cached
      // state. We don't get the per-structure `isProvisioned` torii lookup, so
      // approximate via the packed building counts (the same fallback the
      // real hook uses when its provisioning building check is unavailable).
      let canProvision = false;
      if (
        isBlitzWorld &&
        structure.category === StructureType.Realm &&
        ownerContract !== null &&
        isMainPhase &&
        !isSeasonOver
      ) {
        const ownerMatches = structure.structure?.owner === ownerContract;
        if (ownerMatches) {
          const provisioned = getBuildingCount(BuildingType.ResourceLabor, packedCounts) > 0;
          canProvision = !provisioned;
        }
      }

      return {
        ...structure,
        displayName: name,
        originalName,
        realmLevel: normalizedLevel,
        realmLevelLabel,
        population,
        populationCapacity,
        buildingTilesOccupied: buildingTileSummary?.occupied ?? null,
        buildingTilesTotal: buildingTileSummary?.total ?? null,
        groupColor,
        isFavorite,
        canUpgrade: structure.category === StructureType.Realm && normalizedLevel < maxRealmLevel,
        canProvision,
        buildingCounts,
      };
    });
  }, [
    structures,
    components.StructureBuildings,
    structureGroups,
    nameUpdateVersion,
    favoritesSet,
    mode,
    buildingTileCountsByStructure,
    isBlitzWorld,
    isMainPhase,
    isSeasonOver,
    ownerContract,
  ]);
};
