export type TroopType = 'Knight' | 'Paladin' | 'Crossbowman';
export type TroopTier = 'T1' | 'T2' | 'T3';
export type ArmyStatus = 'idle' | 'moving' | 'exploring' | 'in_combat' | 'garrisoned';

export interface ArmyTroops {
  type: TroopType;
  tier: TroopTier;
  count: number;
}

export interface HexPosition {
  col: number;
  row: number;
}

export interface HexTile {
  col: number;
  row: number;
  biome: string;
  explored: boolean;
  occupier?: string;
  isOwn?: boolean;
}

export interface ArmySummary {
  entityId: number;
  name: string;
  troops: ArmyTroops;
  stamina: number;
  maxStamina: number;
  position: HexPosition;
  status: ArmyStatus;
  food: {wheat: number; fish: number};
  carryCapacity: number;
  currentLoad: number;
  homeRealmId?: number;
  homeRealmName?: string;
}

export interface NearbyArmy {
  entityId: number;
  name: string;
  troops: ArmyTroops;
  position: HexPosition;
  distance: number;
  isEnemy: boolean;
  owner: string;
}

export interface GuardSlot {
  slot: number;
  troops: ArmyTroops | null;
  cooldownEnd: number | null;
}
