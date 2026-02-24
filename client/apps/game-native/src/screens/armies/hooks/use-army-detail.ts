import {useMemo} from 'react';
import type {ArmySummary, NearbyArmy, HexTile} from '../types';

// TODO: Replace with real data from @bibliothecadao/react hooks
const MOCK_ARMIES_MAP: Record<number, ArmySummary> = {
  5001: {
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
  5002: {
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
  5003: {
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
  5004: {
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
  5005: {
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
  5006: {
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
};

const BIOMES = ['Desert', 'Forest', 'Plains', 'Mountains', 'Swamp', 'Tundra', 'Ocean'];

function getNeighborHexes(col: number, row: number): HexTile[] {
  // Hex grid neighbors (offset coordinates - even-q layout)
  const isEvenCol = col % 2 === 0;
  const offsets = isEvenCol
    ? [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [0, 1],
      ]
    : [
        [0, -1],
        [-1, 0],           [1, 0],
        [-1, 1], [0, 1], [1, 1],
      ];

  return offsets.map(([dc, dr], i) => ({
    col: col + dc,
    row: row + dr,
    biome: BIOMES[i % BIOMES.length],
    explored: Math.random() > 0.3,
    occupier: Math.random() > 0.8 ? 'Enemy Camp' : undefined,
    isOwn: false,
  }));
}

const MOCK_NEARBY: NearbyArmy[] = [
  {
    entityId: 9001,
    name: 'Barbarian Raiders',
    troops: {type: 'Knight', tier: 'T1', count: 200},
    position: {col: 143, row: 89},
    distance: 2,
    isEnemy: true,
    owner: '0x1234...abcd',
  },
  {
    entityId: 9002,
    name: 'Dark Scouts',
    troops: {type: 'Crossbowman', tier: 'T2', count: 120},
    position: {col: 140, row: 86},
    distance: 4,
    isEnemy: true,
    owner: '0x5678...efgh',
  },
  {
    entityId: 9003,
    name: 'Allied Patrol',
    troops: {type: 'Paladin', tier: 'T1', count: 80},
    position: {col: 141, row: 88},
    distance: 1,
    isEnemy: false,
    owner: '0x9abc...ijkl',
  },
];

export function useArmyDetail(armyEntityId: number) {
  const army = useMemo(() => MOCK_ARMIES_MAP[armyEntityId] ?? null, [armyEntityId]);

  const neighborHexes = useMemo(() => {
    if (!army) return [];
    return getNeighborHexes(army.position.col, army.position.row);
  }, [army]);

  const nearbyArmies = useMemo(() => MOCK_NEARBY, []);

  return {
    army,
    neighborHexes,
    nearbyArmies,
    isLoading: false,
  };
}
