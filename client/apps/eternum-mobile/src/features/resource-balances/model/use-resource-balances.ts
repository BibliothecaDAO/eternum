import { useBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { ID, resources } from "@bibliothecadao/types";
import { useResourceManager } from "@bibliothecadao/react";
import { useCallback, useEffect, useState } from "react";

interface ResourceAmount {
  id: number;
  amount: number;
}

export function useResourceBalances(entityId: ID) {
  const [resourceAmounts, setResourceAmounts] = useState<ResourceAmount[]>([]);
  const { currentDefaultTick: tick } = useBlockTimestamp();
  const resourceManager = useResourceManager(entityId);

  const updateResourceAmounts = useCallback(() => {
    if (!entityId) return;

    const amounts = resources.map((resource) => ({
      id: resource.id,
      amount: resourceManager.balanceWithProduction(tick, resource.id),
    }));

    setResourceAmounts(amounts);
  }, [entityId, resourceManager, tick]);

  useEffect(() => {
    updateResourceAmounts();

    // Update resources periodically
    const interval = setInterval(updateResourceAmounts, 1000);
    return () => clearInterval(interval);
  }, [updateResourceAmounts]);

  return {
    resourceAmounts,
    updateResourceAmounts,
  };
}
