import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { sqlApi } from "@/services/api";
import type { SettlementPlannerSnapshot, SettlementPlannerTile } from "@bibliothecadao/torii";

import {
  buildSettlementPlannerData,
  buildSettlementPlannerFetchBounds,
  type SettlementPlannerData,
  type SettlementPlannerOptimisticRealm,
} from "./settlement-planner-utils";

const EMPTY_SNAPSHOT: SettlementPlannerSnapshot = {
  realms: [],
  villages: [],
};

const EMPTY_TERRAIN: SettlementPlannerTile[] = [];

interface UseSettlementPlannerDataProps {
  enabled: boolean;
  chain: string;
  worldName: string;
  layerMax: number | null;
  layersSkipped: number | null;
  baseDistance: number | null;
  mapCenterOffset: number;
  optimisticRealms?: SettlementPlannerOptimisticRealm[];
}

interface UseSettlementPlannerDataResult extends SettlementPlannerData {
  snapshot: SettlementPlannerSnapshot;
  isLoading: boolean;
  snapshotError: string | null;
  exploredTilesError: string | null;
  refetch: () => Promise<void>;
}

export const useSettlementPlannerData = ({
  enabled,
  chain,
  worldName,
  layerMax,
  layersSkipped,
  baseDistance,
  mapCenterOffset,
  optimisticRealms = [],
}: UseSettlementPlannerDataProps): UseSettlementPlannerDataResult => {
  const snapshotQuery = useQuery({
    queryKey: ["settlementPlannerSnapshot", chain, worldName],
    enabled,
    queryFn: async () => await sqlApi.fetchSettlementPlannerSnapshot(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const fetchBounds = useMemo(
    () =>
      buildSettlementPlannerFetchBounds({
        snapshot: snapshotQuery.data ?? EMPTY_SNAPSHOT,
        layerMax,
        layersSkipped,
        baseDistance,
        mapCenterOffset,
        optimisticRealms,
      }),
    [snapshotQuery.data, layerMax, layersSkipped, baseDistance, mapCenterOffset, optimisticRealms],
  );

  const exploredTilesQuery = useQuery({
    queryKey: [
      "settlementPlannerExploredTiles",
      chain,
      worldName,
      fetchBounds?.minX ?? null,
      fetchBounds?.maxX ?? null,
      fetchBounds?.minY ?? null,
      fetchBounds?.maxY ?? null,
    ],
    enabled: enabled && fetchBounds != null,
    queryFn: async () => await sqlApi.fetchExploredTilesInBounds(fetchBounds!),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const plannerData = useMemo(
    () =>
      buildSettlementPlannerData({
        snapshot: snapshotQuery.data ?? EMPTY_SNAPSHOT,
        terrainTiles: exploredTilesQuery.data ?? EMPTY_TERRAIN,
        layerMax,
        layersSkipped,
        baseDistance,
        mapCenterOffset,
        optimisticRealms,
      }),
    [
      snapshotQuery.data,
      exploredTilesQuery.data,
      layerMax,
      layersSkipped,
      baseDistance,
      mapCenterOffset,
      optimisticRealms,
    ],
  );

  return {
    snapshot: snapshotQuery.data ?? EMPTY_SNAPSHOT,
    isLoading: snapshotQuery.isLoading || exploredTilesQuery.isLoading,
    snapshotError: snapshotQuery.error instanceof Error ? snapshotQuery.error.message : null,
    exploredTilesError: exploredTilesQuery.error instanceof Error ? exploredTilesQuery.error.message : null,
    refetch: async () => {
      await Promise.all([snapshotQuery.refetch(), exploredTilesQuery.refetch()]);
    },
    ...plannerData,
  };
};
