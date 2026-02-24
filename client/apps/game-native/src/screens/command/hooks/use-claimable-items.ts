import {useMemo} from 'react';
import {useResourceArrivals} from '../../../features/resource-arrivals';

// TODO: Replace with real Dojo queries once DojoProvider is upgraded.

export interface ClaimableItem {
  id: string;
  type: 'caravan' | 'quest' | 'overflow';
  message: string;
  resources: {resourceId: number; amount: number}[];
  onClaim?: () => void;
}

const MOCK_QUEST_REWARDS: ClaimableItem[] = [
  {
    id: 'quest-1',
    type: 'quest',
    message: 'Daily exploration reward available',
    resources: [
      {resourceId: 1, amount: 100},
      {resourceId: 2, amount: 50},
    ],
  },
];

const MOCK_OVERFLOW: ClaimableItem[] = [
  {
    id: 'overflow-1',
    type: 'overflow',
    message: 'Stone production overflow (Havenstone)',
    resources: [{resourceId: 3, amount: 250}],
  },
];

interface UseClaimableItemsResult {
  items: ClaimableItem[];
  totalCount: number;
}

export function useClaimableItems(structureEntityId: number = 0): UseClaimableItemsResult {
  const {claimable: claimableArrivals} = useResourceArrivals(structureEntityId);

  const items = useMemo(() => {
    const caravanItems: ClaimableItem[] = claimableArrivals.map(arrival => ({
      id: `caravan-${arrival.entityId}`,
      type: 'caravan' as const,
      message: `Caravan arrived with ${arrival.resources.length} resource${arrival.resources.length !== 1 ? 's' : ''}`,
      resources: arrival.resources,
      onClaim: () => {
        // TODO: Wire up actual claim action via Dojo transaction
        console.log('Claim caravan', arrival.entityId);
      },
    }));

    const questItems = MOCK_QUEST_REWARDS.map(item => ({
      ...item,
      onClaim: () => console.log('Claim quest reward', item.id),
    }));

    const overflowItems = MOCK_OVERFLOW.map(item => ({
      ...item,
      onClaim: () => console.log('Claim overflow', item.id),
    }));

    return [...caravanItems, ...questItems, ...overflowItems];
  }, [claimableArrivals]);

  return {items, totalCount: items.length};
}
