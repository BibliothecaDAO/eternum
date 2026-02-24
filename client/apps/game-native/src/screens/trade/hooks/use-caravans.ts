import {useMemo} from 'react';
import type {CaravanInfo} from '../types';

// TODO: Replace with real data from ResourceArrivalsManager + Torii queries
const MOCK_CARAVANS: CaravanInfo[] = [
  {
    caravanId: 3001,
    origin: {entityId: 1001, name: 'Ironhold', col: 140, row: 87},
    destination: {entityId: 1002, name: 'Sunspire', col: 200, row: 155},
    resources: [
      {resourceId: 3, amount: 2500},
      {resourceId: 1, amount: 1000},
    ],
    arrivalTime: Math.floor(Date.now() / 1000) + 3600 * 2,
    status: 'in_transit',
  },
  {
    caravanId: 3002,
    origin: {entityId: 1002, name: 'Sunspire', col: 200, row: 155},
    destination: {entityId: 1001, name: 'Ironhold', col: 140, row: 87},
    resources: [{resourceId: 7, amount: 500}],
    arrivalTime: Math.floor(Date.now() / 1000) + 1800,
    status: 'in_transit',
  },
  {
    caravanId: 3003,
    origin: {entityId: 1003, name: 'Thornwatch', col: 310, row: 220},
    destination: {entityId: 1001, name: 'Ironhold', col: 140, row: 87},
    resources: [
      {resourceId: 9, amount: 200},
      {resourceId: 11, amount: 800},
    ],
    arrivalTime: Math.floor(Date.now() / 1000) - 60,
    status: 'ready',
  },
  {
    caravanId: 3004,
    origin: {entityId: 1004, name: 'Mistral Bay', col: 420, row: 300},
    destination: {entityId: 1001, name: 'Ironhold', col: 140, row: 87},
    resources: [{resourceId: 6, amount: 1500}],
    arrivalTime: Math.floor(Date.now() / 1000) + 3600 * 5,
    status: 'in_transit',
  },
];

export function useCaravans() {
  const caravans = useMemo(() => MOCK_CARAVANS, []);

  const inTransit = useMemo(
    () => caravans.filter(c => c.status === 'in_transit'),
    [caravans],
  );

  const readyToClaim = useMemo(
    () => caravans.filter(c => c.status === 'ready'),
    [caravans],
  );

  return {
    caravans,
    inTransit,
    readyToClaim,
    totalCount: caravans.length,
    isLoading: false,
  };
}
