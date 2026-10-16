import { configManager, formatTime } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
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

const getEssenceCostForRelic = (relicInfo: RelicInfoResult): number => {
  if (!relicInfo) {
    return 0;
  }

  return RELIC_COST_PER_LEVEL[relicInfo.level] ?? 0;
};

export const useRelicMetadata = (relicId: ID) => {
  const keys = { game_id: configManager.getActiveGameId() };
  const rules = useNativeRow("RelicRules", keys);
  const preset = useNativeRow("SliceRules", keys);
  const relicInfo = useMemo(() => {
    const info = getRelicInfo(relicId as ResourcesIds);
    if (!info || !rules || !preset) return undefined;
    const rule = rules.rules[Number(relicId) - 39];
    if (!rule) throw new Error(`Missing relic rule ${relicId}`);
    const ticks = info.type === "Stamina" ? rule.uses : rule.duration;
    return {
      ...info,
      duration: ticks ? formatTime(ticks * Number(preset.tick_config.armies_tick_in_seconds)) : undefined,
    };
  }, [relicId, rules, preset]);
  const resourceName = useMemo(() => findResourceById(relicId)?.trait ?? "Unknown Relic", [relicId]);
  const essenceCost = useMemo(() => getEssenceCostForRelic(relicInfo), [relicInfo]);

  return {
    relicInfo,
    resourceName,
    resourceId: Number(relicId) as ResourcesIds,
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
