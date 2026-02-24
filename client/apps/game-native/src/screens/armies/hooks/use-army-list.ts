import {useMemo} from 'react';
import type {ArmySummary} from '../types';

// TODO: Replace with real data from useExplorersByStructure from @bibliothecadao/react
const MOCK_ARMIES: ArmySummary[] = [
  {
    entityId: 5001,
    name: 'Iron Vanguard',
    troops: {type: 'Knight', tier: 'T2', count: 320},
    stamina: 75,
    maxStamina: 100,
    position: {col: 142, row: 88},
    status: 'idle',
    food: {wheat: 1200, fish: 800},
    carryCapacity: 5000,
    currentLoad: 1500,
    homeRealmId: 1,
    homeRealmName: 'Ironhold',
  },
  {
    entityId: 5002,
    name: 'Shadow Scouts',
    troops: {type: 'Crossbowman', tier: 'T1', count: 180},
    stamina: 30,
    maxStamina: 100,
    position: {col: 145, row: 91},
    status: 'exploring',
    food: {wheat: 400, fish: 300},
    carryCapacity: 3000,
    currentLoad: 2800,
    homeRealmId: 1,
    homeRealmName: 'Ironhold',
  },
  {
    entityId: 5003,
    name: 'Sunspire Guard',
    troops: {type: 'Paladin', tier: 'T3', count: 150},
    stamina: 100,
    maxStamina: 100,
    position: {col: 200, row: 155},
    status: 'idle',
    food: {wheat: 2000, fish: 1500},
    carryCapacity: 4000,
    currentLoad: 500,
    homeRealmId: 2,
    homeRealmName: 'Sunspire',
  },
  {
    entityId: 5004,
    name: 'Thorn Marauders',
    troops: {type: 'Knight', tier: 'T1', count: 500},
    stamina: 0,
    maxStamina: 100,
    position: {col: 310, row: 220},
    status: 'moving',
    food: {wheat: 100, fish: 50},
    carryCapacity: 6000,
    currentLoad: 4200,
    homeRealmId: 3,
    homeRealmName: 'Thornwatch',
  },
  {
    entityId: 5005,
    name: 'Mistral Rangers',
    troops: {type: 'Crossbowman', tier: 'T2', count: 240},
    stamina: 55,
    maxStamina: 100,
    position: {col: 420, row: 300},
    status: 'in_combat',
    food: {wheat: 600, fish: 400},
    carryCapacity: 3500,
    currentLoad: 1000,
    homeRealmId: 4,
    homeRealmName: 'Mistral Bay',
  },
  {
    entityId: 5006,
    name: 'Ironhold Garrison',
    troops: {type: 'Paladin', tier: 'T2', count: 200},
    stamina: 90,
    maxStamina: 100,
    position: {col: 140, row: 87},
    status: 'garrisoned',
    food: {wheat: 1800, fish: 1200},
    carryCapacity: 4500,
    currentLoad: 0,
    homeRealmId: 1,
    homeRealmName: 'Ironhold',
  },
];

export function useArmyList() {
  const armies = useMemo(() => MOCK_ARMIES, []);

  const armiesByStatus = useMemo(() => {
    const idle = armies.filter(a => a.status === 'idle');
    const active = armies.filter(a => ['moving', 'exploring', 'in_combat'].includes(a.status));
    const garrisoned = armies.filter(a => a.status === 'garrisoned');
    return {idle, active, garrisoned};
  }, [armies]);

  return {
    armies,
    armiesByStatus,
    totalCount: armies.length,
    isLoading: false,
  };
}
