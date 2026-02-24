import {useMemo} from 'react';
import {getBlockTimestamp} from '../../shared/hooks/use-block-timestamp';
import {ResourceArrival, ResourceArrivalSummary} from './types';

// TODO: Import from shared packages once full Dojo context is wired up (Sub-Phase 2a.1)
// import {useDojo, useArrivalsByStructure} from '@bibliothecadao/react';
// import {ResourceArrivalManager} from '@bibliothecadao/eternum';

interface UseResourceArrivalsResult {
  arrivals: ResourceArrival[];
  claimable: ResourceArrival[];
  summary: ResourceArrivalSummary;
}

// TODO: Replace with real Dojo arrival queries once DojoProvider is upgraded.
// Pattern: useArrivalsByStructure(structureEntityId) -> filter by arrivesAt <= currentBlockTimestamp
const MOCK_ARRIVALS: ResourceArrival[] = [];

export function useResourceArrivals(
  _structureEntityId: number,
): UseResourceArrivalsResult {
  const {currentBlockTimestamp} = getBlockTimestamp();

  const arrivals = MOCK_ARRIVALS;

  const claimable = useMemo(
    () => arrivals.filter(arrival => arrival.arrivesAt <= currentBlockTimestamp),
    [arrivals, currentBlockTimestamp],
  );

  const summary: ResourceArrivalSummary = useMemo(
    () => ({
      readyArrivals: claimable.length,
      pendingArrivals: arrivals.length - claimable.length,
      totalResources: arrivals.reduce((total, arrival) => total + arrival.resources.length, 0),
    }),
    [arrivals, claimable],
  );

  return {arrivals, claimable, summary};
}
