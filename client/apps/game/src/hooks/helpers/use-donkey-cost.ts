import { calculateDonkeysNeeded, divideByPrecision, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { ID, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useBlockTimestamp } from "./use-block-timestamp";

interface DonkeyCostResult {
  donkeysNeeded: number;
  donkeyBalance: number;
  weightKg: number;
  canTransport: boolean;
}

export const useDonkeyCost = (
  entityId: ID,
  resourceId: ResourcesIds,
  amount: number,
  isBuyingResource: boolean,
): DonkeyCostResult => {
  const { currentDefaultTick } = useBlockTimestamp();
  const resourceManager = useResourceManager(entityId);

  const weightKg = useMemo(() => {
    // When buying a resource, the player sends Lords. When selling, sends the resource.
    const transportedResourceId = isBuyingResource ? ResourcesIds.Lords : resourceId;
    const transportedAmount = amount;
    return getTotalResourceWeightKg([{ resourceId: transportedResourceId, amount: transportedAmount }]);
  }, [resourceId, amount, isBuyingResource]);

  const donkeysNeeded = useMemo(() => {
    return calculateDonkeysNeeded(weightKg);
  }, [weightKg]);

  const donkeyBalance = useMemo(() => {
    return divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance);
  }, [resourceManager, currentDefaultTick]);

  const canTransport = useMemo(() => {
    if (resourceId === ResourcesIds.Donkey) return true;
    return donkeyBalance >= donkeysNeeded;
  }, [donkeyBalance, donkeysNeeded, resourceId]);

  return { donkeysNeeded, donkeyBalance, weightKg, canTransport };
};
