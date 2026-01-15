import { useMemo } from "react";

import { divideByPrecision } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import {
  findResourceById,
  getRelicInfo,
  ID,
  RELIC_COST_PER_LEVEL,
  RelicRecipientType,
  ResourcesIds,
} from "@bibliothecadao/types";

export type RelicInfoResult = ReturnType<typeof getRelicInfo> | undefined;

export const resolveRelicResourceKey = (resourceId: ID): string => {
  if (typeof resourceId === "number") {
    const key = ResourcesIds[resourceId];
    if (typeof key === "string") {
      return key;
    }
  }

  if (typeof resourceId === "string") {
    const numericId = Number(resourceId);
    if (!Number.isNaN(numericId)) {
      const key = ResourcesIds[numericId];
      if (typeof key === "string") {
        return key;
      }
    }

    if (resourceId in ResourcesIds) {
      return resourceId;
    }
  }

  return resourceId.toString();
};

const getEssenceCostForRelic = (relicInfo: RelicInfoResult): number => {
  if (!relicInfo) {
    return 0;
  }

  return RELIC_COST_PER_LEVEL[relicInfo.level] ?? 0;
};

export const useRelicMetadata = (relicId: ID) => {
  const relicInfo = useMemo(() => getRelicInfo(relicId as ResourcesIds), [relicId]);
  const resourceName = useMemo(() => findResourceById(relicId)?.trait ?? "Unknown Relic", [relicId]);
  const resourceKey = useMemo(() => resolveRelicResourceKey(relicId), [relicId]);
  const essenceCost = useMemo(() => getEssenceCostForRelic(relicInfo), [relicInfo]);

  return {
    relicInfo,
    resourceName,
    resourceKey,
    essenceCost,
  } as const;
};

export const useRelicEssenceStatus = (entityOwnerId: ID, essenceCost: number) => {
  const resourceManager = useResourceManager(entityOwnerId);

  const essenceBalance = useMemo(
    () => divideByPrecision(Number(resourceManager.balance(ResourcesIds.Essence))),
    [resourceManager],
  );

  const hasEnoughEssence = essenceBalance >= essenceCost;
  const missingEssence = Math.max(0, essenceCost - essenceBalance);

  return {
    essenceBalance,
    hasEnoughEssence,
    missingEssence,
  } as const;
};

export const isRelicCompatible = (relicInfo: RelicInfoResult, recipientType: RelicRecipientType): boolean => {
  if (!relicInfo) {
    return false;
  }

  return relicInfo.recipientType === recipientType;
};
