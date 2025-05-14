import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { divideByPrecision, multiplyByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { useCallback, useMemo } from "react";
import { useProduction } from "./use-production";

export const useResourceProduction = (resourceId: number) => {
  const { structureEntityId } = useStore();
  const resourceManager = useResourceManager(structureEntityId);
  const { startResourceProduction, pauseProduction, resumeProduction, destroyProduction } = useProduction();

  const availableAmount = useMemo(() => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    const balance = resourceManager.balanceWithProduction(currentBlockTimestamp, resourceId);
    return divideByPrecision(Number(balance));
  }, [resourceManager, resourceId]);

  const productionStatus = useMemo(() => {
    const resource = resourceManager.getResource();
    if (!resource) return null;
    const production = ResourceManager.balanceAndProduction(resource, resourceId).production;
    return {
      isActive: production?.building_count! > 0,
      amount: production?.output_amount_left ? divideByPrecision(Number(production.output_amount_left)) : 0,
      rate: production?.production_rate ? divideByPrecision(Number(production.production_rate)) : 0,
      lastUpdated: production?.last_updated_at || 0,
    };
  }, [resourceManager, resourceId]);

  const startProduction = useCallback(
    async (amount: number) => {
      if (amount <= 0 || amount > availableAmount) return false;

      return await startResourceProduction({
        entity_id: structureEntityId,
        resource_type: resourceId,
        amount: multiplyByPrecision(amount),
      });
    },
    [structureEntityId, resourceId, availableAmount, startResourceProduction],
  );

  const pauseResourceProduction = useCallback(async () => {
    return await pauseProduction();
  }, [resourceId, pauseProduction]);

  const resumeResourceProduction = useCallback(async () => {
    return await resumeProduction();
  }, [resourceId, resumeProduction]);

  const destroyResourceProduction = useCallback(async () => {
    return await destroyProduction();
  }, [resourceId, destroyProduction]);

  return {
    availableAmount,
    productionStatus,
    startProduction,
    pauseResourceProduction,
    resumeResourceProduction,
    destroyResourceProduction,
  };
};
