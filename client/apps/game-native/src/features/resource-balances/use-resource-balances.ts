import {useCallback, useEffect, useState} from 'react';
import {useBlockTimestamp} from '../../shared/hooks/use-block-timestamp';

// TODO: Import from shared packages once full Dojo context is wired up (Sub-Phase 2a.1)
// import {useResourceManager} from '@bibliothecadao/react';
// import {resources} from '@bibliothecadao/types';

export interface ResourceAmount {
  resourceId: number;
  amount: number;
  maxAmount: number;
}

interface UseResourceBalancesResult {
  resourceAmounts: ResourceAmount[];
  updateResourceAmounts: () => void;
}

// TODO: Replace with real Dojo resource manager queries once DojoProvider is upgraded.
// Pattern: useResourceManager(entityId) -> resourceManager.balanceWithProduction(tick, resourceId)
const MOCK_RESOURCES: ResourceAmount[] = [
  {resourceId: 1, amount: 1000, maxAmount: 5000},
  {resourceId: 2, amount: 2500, maxAmount: 5000},
  {resourceId: 3, amount: 750, maxAmount: 5000},
];

export function useResourceBalances(entityId: number): UseResourceBalancesResult {
  const {currentDefaultTick} = useBlockTimestamp();
  const [resourceAmounts, setResourceAmounts] = useState<ResourceAmount[]>([]);

  const updateResourceAmounts = useCallback(() => {
    if (!entityId) {
      setResourceAmounts([]);
      return;
    }
    // TODO: Replace with real implementation using resourceManager.balanceWithProduction
    setResourceAmounts(MOCK_RESOURCES);
  }, [entityId, currentDefaultTick]);

  useEffect(() => {
    updateResourceAmounts();
    const interval = setInterval(updateResourceAmounts, 1000);
    return () => clearInterval(interval);
  }, [updateResourceAmounts]);

  return {resourceAmounts, updateResourceAmounts};
}
