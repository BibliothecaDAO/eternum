import { useMemo } from "react";

import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import {
  divideByPrecision,
  getStructureRelicEffects,
  getStructureTypeName,
  getEntityIdFromKeys,
  getIsBlitz,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getResourceTiers, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";

import type { SelectedEntity } from "./transfer-types";

export interface StructurePreviewResource {
  resourceId: ResourcesIds;
  label: string;
  balance: number;
  perHour: number;
  timeRemainingMinutes: number | null;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  buildingCount: number;
}

export interface StructurePreviewMeta {
  typeLabel: string;
  hasWonderBonus: boolean;
  wonderBonusPercent: number | null;
  activeRelicCount: number;
}

export interface StructurePreview {
  resources: StructurePreviewResource[];
  topBalances: StructurePreviewResource[];
  balanceOverflow: StructurePreviewResource[];
  meta: StructurePreviewMeta;
  isReady: boolean;
}

const toMinutes = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) {
    return null;
  }

  return Math.ceil(seconds / 60);
};

const sortByBalance = (resources: StructurePreviewResource[]) => [...resources].sort((a, b) => b.balance - a.balance);

export const useStructurePreview = (structure: SelectedEntity | null): StructurePreview => {
  const {
    setup: {
      components: { ProductionBoostBonus },
    },
  } = useDojo();

  const resourceManager = useResourceManager(structure?.entityId || 0);
  const { currentDefaultTick, currentArmiesTick } = useBlockTimestamp();

  const productionBoostBonus = useComponentValue(
    ProductionBoostBonus,
    structure ? getEntityIdFromKeys([BigInt(structure.entityId)]) : undefined,
  );

  const meta: StructurePreviewMeta = useMemo(() => {
    if (!structure) {
      return {
        typeLabel: "",
        hasWonderBonus: false,
        wonderBonusPercent: null,
        activeRelicCount: 0,
      };
    }

    const wonderIncrement = productionBoostBonus?.wonder_incr_percent_num || 0;
    const wonderBonusPercent = wonderIncrement > 0 ? wonderIncrement / 100 : null;
    const relicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick || 0)
      : [];

    return {
      typeLabel: getStructureTypeName(structure.category as StructureType, getIsBlitz()),
      hasWonderBonus: wonderIncrement > 0,
      wonderBonusPercent,
      activeRelicCount: relicEffects.length,
    };
  }, [structure, productionBoostBonus, currentArmiesTick]);

  const resources = useMemo<StructurePreviewResource[]>(() => {
    if (!structure || !resourceManager || !currentDefaultTick) {
      return [];
    }

    const resourceComponent = resourceManager.getResource();
    if (!resourceComponent) {
      return [];
    }

    const tiers = Object.values(getResourceTiers(getIsBlitz()));
    const flat = tiers.flat();
    const next: StructurePreviewResource[] = [];

    flat.forEach((resourceId) => {
      if (resourceId === ResourcesIds.Labor) {
        return;
      }

      const productionInfo = ResourceManager.balanceAndProduction(resourceComponent, resourceId);
      const productionData = ResourceManager.calculateResourceProductionData(
        resourceId,
        productionInfo,
        currentDefaultTick,
      );

      const balanceValue = resourceManager.balance(resourceId) ?? 0n;
      const perHour = productionData.productionPerSecond ? productionData.productionPerSecond * 3600 : 0;
      const balance = divideByPrecision(Number(balanceValue));
      const label = ResourcesIds[resourceId];
      const buildingCount = productionInfo.production.building_count || 0;
      const timeRemainingSeconds = productionData.timeRemainingSeconds ?? null;

      next.push({
        resourceId,
        label,
        balance,
        perHour,
        timeRemainingMinutes: toMinutes(timeRemainingSeconds),
        isProducing: productionData.isProducing,
        timeRemainingSeconds: timeRemainingSeconds ?? null,
        buildingCount,
      });
    });

    return next;
  }, [structure, resourceManager, currentDefaultTick]);

  const productionHighlights = useMemo(() => {
    const withBuildings = resources.filter((item) => item.buildingCount > 0);

    return [...withBuildings]
      .sort((a, b) => {
        if (a.isProducing !== b.isProducing) {
          return a.isProducing ? -1 : 1;
        }
        if (b.perHour !== a.perHour) {
          return b.perHour - a.perHour;
        }
        if (b.buildingCount !== a.buildingCount) {
          return b.buildingCount - a.buildingCount;
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, 3);
  }, [resources]);

  const sortedBalances = useMemo(() => sortByBalance(resources.filter((item) => item.balance > 0)), [resources]);
  const topBalances = useMemo(() => sortedBalances.slice(0, 3), [sortedBalances]);
  const balanceOverflow = useMemo(() => sortedBalances.slice(3), [sortedBalances]);

  return {
    resources: productionHighlights,
    topBalances,
    balanceOverflow,
    meta,
    isReady: Boolean(structure && resourceManager),
  };
};
