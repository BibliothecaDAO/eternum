import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceManager } from "@bibliothecadao/eternum";
import { useBuildings } from "@bibliothecadao/react";
import { ResourcesIds, getProducedResource } from "@bibliothecadao/types";
import { useMemo } from "react";

export interface ResourceProductionSummaryItem {
  resourceId: ResourcesIds;
  totalBuildings: number;
  activeBuildings: number;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  productionPerSecond: number | null;
  outputRemaining: number | null;
  calculatedAt: number;
}

export interface StructureProductionSummary {
  items: ResourceProductionSummaryItem[];
  totalProductionBuildings: number;
  activeProductionBuildings: number;
}

interface ProductionBuildingLike {
  category?: number | bigint;
  produced?: {
    resource?: number | bigint;
  };
}

interface BuildStructureProductionSummaryInput {
  productionBuildings: ProductionBuildingLike[];
  resources: ResourceManager;
  currentDefaultTick: number;
  calculatedAt?: number;
}

const EMPTY_PRODUCTION_SUMMARY: StructureProductionSummary = {
  items: [],
  totalProductionBuildings: 0,
  activeProductionBuildings: 0,
};

const isProductionBuilding = (
  building: ProductionBuildingLike | null | undefined,
): building is ProductionBuildingLike => {
  if (!building?.category) return false;
  return Boolean(getProducedResource(Number(building.category)));
};

export const buildStructureProductionSummary = ({
  productionBuildings,
  resources,
  currentDefaultTick,
  calculatedAt = Date.now(),
}: BuildStructureProductionSummaryInput): StructureProductionSummary => {
  if (!productionBuildings.length) return EMPTY_PRODUCTION_SUMMARY;

  const summaries = new Map<ResourcesIds, { totalBuildings: number }>();

  productionBuildings.forEach((building) => {
    const rawResourceId = building.produced?.resource;
    if (rawResourceId === undefined || rawResourceId === null) return;

    const resourceId = Number(rawResourceId) as ResourcesIds;
    if (!Number.isFinite(resourceId) || resourceId === ResourcesIds.Labor) return;

    const summary = summaries.get(resourceId);
    if (summary) {
      summary.totalBuildings += 1;
      return;
    }

    summaries.set(resourceId, { totalBuildings: 1 });
  });

  const items = Array.from(summaries.entries()).flatMap(([resourceId, stats]) => {
    const productionInfo = resources.current(resourceId);
    if (!productionInfo) return [];
    const productionData = ResourceManager.calculateResourceProductionData(
      resourceId,
      productionInfo,
      currentDefaultTick || 0,
    );
    const isProducing = productionData.isProducing;
    const buildingCount = Number(productionInfo?.production?.building_count ?? 0);
    const activeBuildings = isProducing ? (buildingCount > 0 ? buildingCount : stats.totalBuildings) : 0;

    return [
      {
        resourceId,
        totalBuildings: stats.totalBuildings,
        activeBuildings,
        isProducing,
        timeRemainingSeconds: Number.isFinite(productionData.timeRemainingSeconds)
          ? productionData.timeRemainingSeconds
          : null,
        productionPerSecond: Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null,
        outputRemaining: Number.isFinite(productionData.outputRemaining) ? productionData.outputRemaining : null,
        calculatedAt,
      },
    ];
  });

  return summarizeProductionItems(items);
};

const summarizeProductionItems = (items: ResourceProductionSummaryItem[]): StructureProductionSummary => ({
  items,
  totalProductionBuildings: items.reduce((total, summary) => total + summary.totalBuildings, 0),
  activeProductionBuildings: items.reduce((total, summary) => total + summary.activeBuildings, 0),
});

export const useStructureProductionSummary = (
  structure?: NativeRows["Structure"] | null,
  resources?: ResourceManager | null,
): StructureProductionSummary => {
  const currentDefaultTick = useCurrentDefaultTick();
  const buildingsData = useBuildings(
    Number(structure?.base.coord_x ?? 0),
    Number(structure?.base.coord_y ?? 0),
    structure?.base.alt ?? false,
  );

  return useMemo(() => {
    if (!structure || !resources) return EMPTY_PRODUCTION_SUMMARY;

    const productionBuildings = (buildingsData ?? []).filter(isProductionBuilding);
    return buildStructureProductionSummary({
      productionBuildings,
      resources,
      currentDefaultTick,
    });
  }, [buildingsData, currentDefaultTick, resources, structure]);
};
