import {useMemo} from 'react';

export interface RealmSummary {
  entityId: number;
  name: string;
  level: number;
  levelName: string;
  coordX: number;
  coordY: number;
  topResources: {resourceId: number; amount: number; maxAmount: number}[];
  capacityPercent: number;
  buildingCount: number;
  totalSlots: number;
  guardStatus: 'defended' | 'vulnerable';
  productionStatus: 'running' | 'paused' | 'at-capacity';
}

// TODO: Replace mock data with real Dojo integration via usePlayerOwnedRealmsInfo
const MOCK_REALMS: RealmSummary[] = [
  {
    entityId: 1001,
    name: 'Ironhold',
    level: 3,
    levelName: 'Citadel',
    coordX: 142,
    coordY: -87,
    topResources: [
      {resourceId: 1, amount: 8500, maxAmount: 10000},
      {resourceId: 2, amount: 3200, maxAmount: 5000},
      {resourceId: 3, amount: 1800, maxAmount: 5000},
      {resourceId: 5, amount: 4100, maxAmount: 8000},
      {resourceId: 8, amount: 950, maxAmount: 3000},
    ],
    capacityPercent: 0.72,
    buildingCount: 8,
    totalSlots: 12,
    guardStatus: 'defended',
    productionStatus: 'running',
  },
  {
    entityId: 1002,
    name: 'Sunspire',
    level: 2,
    levelName: 'Fortress',
    coordX: -56,
    coordY: 203,
    topResources: [
      {resourceId: 4, amount: 6200, maxAmount: 8000},
      {resourceId: 6, amount: 2900, maxAmount: 4000},
      {resourceId: 7, amount: 1500, maxAmount: 3000},
      {resourceId: 9, amount: 500, maxAmount: 2000},
    ],
    capacityPercent: 0.55,
    buildingCount: 5,
    totalSlots: 10,
    guardStatus: 'vulnerable',
    productionStatus: 'running',
  },
  {
    entityId: 1003,
    name: 'Thornwatch',
    level: 1,
    levelName: 'Keep',
    coordX: 88,
    coordY: 14,
    topResources: [
      {resourceId: 1, amount: 9800, maxAmount: 10000},
      {resourceId: 3, amount: 4700, maxAmount: 5000},
      {resourceId: 10, amount: 2800, maxAmount: 3000},
    ],
    capacityPercent: 0.95,
    buildingCount: 3,
    totalSlots: 8,
    guardStatus: 'defended',
    productionStatus: 'at-capacity',
  },
  {
    entityId: 1004,
    name: 'Mistral Bay',
    level: 2,
    levelName: 'Fortress',
    coordX: -120,
    coordY: -45,
    topResources: [
      {resourceId: 2, amount: 200, maxAmount: 5000},
      {resourceId: 6, amount: 100, maxAmount: 4000},
      {resourceId: 11, amount: 50, maxAmount: 2000},
    ],
    capacityPercent: 0.12,
    buildingCount: 4,
    totalSlots: 10,
    guardStatus: 'vulnerable',
    productionStatus: 'paused',
  },
];

export function useRealmSummaries(): RealmSummary[] {
  return useMemo(() => MOCK_REALMS, []);
}
