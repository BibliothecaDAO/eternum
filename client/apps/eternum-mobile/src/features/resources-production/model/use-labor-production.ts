import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import useStore from "@/shared/store";
import { configManager, divideByPrecision, multiplyByPrecision } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { useCallback, useMemo, useState } from "react";
import { calculateLaborAmount } from "../lib/labor";
import { SelectedResource } from "./types";
import { useProduction } from "./use-production";

export const useLaborProduction = () => {
  const { structureEntityId } = useStore();
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const resourceManager = useResourceManager(structureEntityId);
  const { startLaborProduction } = useProduction();

  const laborConfigs = useMemo(() => {
    return selectedResources.map((r) => configManager.getLaborConfig(r.id));
  }, [selectedResources]);

  const { laborAmount, ticks } = useMemo(() => {
    return calculateLaborAmount(selectedResources, laborConfigs);
  }, [selectedResources, laborConfigs]);

  const availableResources = useMemo(() => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    return selectedResources.map((resource) => {
      const resourceBalance = resourceManager.balanceWithProduction(currentBlockTimestamp, resource.id);
      return {
        resourceId: resource.id,
        amount: resourceBalance,
      };
    });
  }, [selectedResources, resourceManager]);

  const addResource = useCallback(
    (resourceId: number) => {
      if (!selectedResources.some((r) => r.id === resourceId)) {
        setSelectedResources([...selectedResources, { id: resourceId, amount: 0 }]);
      }
    },
    [selectedResources],
  );

  const removeResource = useCallback(
    (resourceId: number) => {
      setSelectedResources(selectedResources.filter((r) => r.id !== resourceId));
    },
    [selectedResources],
  );

  const updateResourceAmount = useCallback(
    (resourceId: number, amount: number) => {
      setSelectedResources(selectedResources.map((r) => (r.id === resourceId ? { ...r, amount } : r)));
    },
    [selectedResources],
  );

  const setMaxAmount = useCallback(
    (resourceId: number) => {
      const resource = availableResources.find((r) => r.resourceId === resourceId);
      if (resource) {
        const balance = divideByPrecision(Number(resource.amount));
        updateResourceAmount(resourceId, balance);
      }
    },
    [availableResources, updateResourceAmount],
  );

  const hasInsufficientResources = useMemo(() => {
    return selectedResources.some((resource) => {
      const availableAmount = divideByPrecision(
        Number(availableResources.find((r) => r.resourceId === resource.id)?.amount || 0),
      );
      return resource.amount > availableAmount;
    });
  }, [selectedResources, availableResources]);

  const startProduction = useCallback(async () => {
    if (hasInsufficientResources || selectedResources.length === 0) return false;

    return await startLaborProduction({
      entity_id: structureEntityId,
      resource_types: selectedResources.map((r) => r.id),
      resource_amounts: selectedResources.map((r) => multiplyByPrecision(r.amount)),
    });
  }, [structureEntityId, selectedResources, hasInsufficientResources, startLaborProduction]);

  return {
    selectedResources,
    laborAmount,
    ticks,
    availableResources,
    hasInsufficientResources,
    addResource,
    removeResource,
    updateResourceAmount,
    setMaxAmount,
    startProduction,
  };
};
