import { useMemo } from "react";

import { knownBalance } from "@/ui/utils/utils";
import { useResourceManager } from "@/hooks/helpers/use-resources";
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

  const essenceBalance = useMemo(() => knownBalance(resourceManager.balance(ResourcesIds.Essence)), [resourceManager]);

  // A balance this client cannot see never covers the cost.
  const hasEnoughEssence = essenceBalance !== undefined && essenceBalance >= essenceCost;
  const shortfall =
    essenceBalance === undefined
      ? "Essence balance unknown."
      : `Need ${Math.max(0, essenceCost - essenceBalance).toLocaleString()} more essence.`;

  return {
    essenceBalance,
    hasEnoughEssence,
    shortfall,
  } as const;
};

export const isRelicCompatible = (relicInfo: RelicInfoResult, recipientType: RelicRecipientType): boolean => {
  if (!relicInfo) {
    return false;
  }

  return relicInfo.recipientType === recipientType;
};
