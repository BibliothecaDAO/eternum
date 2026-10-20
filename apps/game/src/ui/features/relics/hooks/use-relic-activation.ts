import { relicEffectLine } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useMemo } from "react";

import { knownAmount } from "@/ui/utils/utils";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { getRelicInfo, ID, RelicRecipientType, ResourcesIds, resourceName, formatCharge } from "@bibliothecadao/types";

export type RelicInfoResult = ReturnType<typeof getRelicInfo> | undefined;

/**
 * A relic as its activation surfaces read it: what it does and for how long, and the Essence it costs, from the
 * game's relic rules (the same accessor every relic hover reads); none until the rules have arrived.
 */
export const useRelicMetadata = (relicId: ID) => {
  const rules = useNativeRow("RelicRules", { game_id: configManager.getActiveGameId() });
  const relicInfo = useMemo(() => {
    const info = getRelicInfo(relicId as ResourcesIds);
    if (!info || !rules) return undefined;
    return { ...info, effectLine: relicEffectLine(relicId as ResourcesIds, configManager.getRelicActivation(relicId)) };
  }, [relicId, rules]);
  const essenceCost = useMemo(
    () => (relicInfo ? configManager.getRelicActivation(relicId).essenceCost : 0),
    [relicId, relicInfo],
  );

  return {
    relicInfo,
    resourceName: resourceName(relicId),
    resourceId: Number(relicId) as ResourcesIds,
    essenceCost,
  } as const;
};

export const useRelicEssenceStatus = (entityOwnerId: ID | undefined, essenceCost: number) => {
  const resourceManager = useResourceManager(entityOwnerId);

  const essenceBalance = useMemo(() => knownAmount(resourceManager?.balance(ResourcesIds.Essence)), [resourceManager]);

  // A balance this client cannot see never covers the cost.
  const hasEnoughEssence = essenceBalance !== undefined && essenceBalance >= essenceCost;
  const shortfall =
    essenceBalance === undefined
      ? "Essence balance unknown."
      : `Need ${formatCharge(Math.max(0, essenceCost - essenceBalance))} more essence.`;

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

/**
 * The Essence a relic's holder can pay an activation with: a structure its own, an army its home structure's; unknown
 * while that balance is not known, or with no holder.
 */
export const useRelicPayerEssence = (holderId: ID | undefined, isArmy: boolean): number | undefined => {
  const explorer = useNativeRow(
    "ExplorerTroops",
    isArmy && holderId !== undefined ? { game_id: configManager.getActiveGameId(), explorer_id: holderId } : undefined,
  );
  const payerId = isArmy ? (explorer ? Number(explorer.owner) : undefined) : holderId;
  const payer = useResourceManager(payerId);
  return useMemo(() => knownAmount(payer?.balance(ResourcesIds.Essence)), [payer]);
};
