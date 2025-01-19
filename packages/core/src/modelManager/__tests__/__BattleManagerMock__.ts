import { type ClientComponents } from "@/dojo/createClientComponents";
import { type ArmyInfo } from "@/hooks/helpers/useArmies";
import { type Structure } from "@/hooks/helpers/useStructures";
import { BattleSide, type ID, StructureType } from "@bibliothecadao/eternum";
import { type ComponentValue } from "@dojoengine/recs";

export const CURRENT_TIMESTAMP = 2;
export const DURATION_LEFT_IF_ONGOING = 1000n;
export const LAST_UPDATED = 0n;

export const ARMY_ENTITY_ID = 1;
export const BATTLE_ENTITY_ID = 10;

const getTroopHeathSimplified = (troopCount: bigint): bigint => {
  return troopCount * 2n;
};

export const BATTLE_TROOP_COUNT = 10n;
export const BATTLE_INITIAL_HEALTH = getTroopHeathSimplified(BATTLE_TROOP_COUNT);

export const ARMY_TROOP_COUNT = 5n;
export const ARMY_INITIAL_HEALTH = getTroopHeathSimplified(ARMY_TROOP_COUNT);

export const generateMockBatle = (
  isOngoing: boolean,
  lastUpdated?: number,
  loser?: BattleSide,
): ComponentValue<ClientComponents["Battle"]["schema"]> => {
  return {
    entity_id: BATTLE_ENTITY_ID,
    attack_army: {
      troops: { knight_count: BATTLE_TROOP_COUNT, paladin_count: BATTLE_TROOP_COUNT, crossbowman_count: 0n },
      battle_id: 0,
      battle_side: "Attack",
    },
    defence_army: {
      troops: { knight_count: BATTLE_TROOP_COUNT, paladin_count: BATTLE_TROOP_COUNT, crossbowman_count: 0n },
      battle_id: 0,
      battle_side: "Defence",
    },
    attack_army_lifetime: {
      troops: {
        knight_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        paladin_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        crossbowman_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
      },
      battle_id: 0,
      battle_side: "Attack",
    },
    defence_army_lifetime: {
      troops: {
        knight_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        paladin_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        crossbowman_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
      },
      battle_id: 0,
      battle_side: "Defence",
    },
    attackers_resources_escrow_id: 0,
    defenders_resources_escrow_id: 0,
    attack_army_health: {
      current: loser === BattleSide.Attack ? 0n : BATTLE_INITIAL_HEALTH,
      lifetime: BATTLE_INITIAL_HEALTH,
    },
    defence_army_health: {
      current: loser === BattleSide.Defence ? 0n : BATTLE_INITIAL_HEALTH,
      lifetime: BATTLE_INITIAL_HEALTH,
    },
    attack_delta: 2n,
    defence_delta: 2n,
    duration_left: isOngoing ? DURATION_LEFT_IF_ONGOING : 0n,
    last_updated: BigInt(lastUpdated ?? LAST_UPDATED),
    start_at: BigInt(lastUpdated ?? LAST_UPDATED),
  };
};

export const generateMockArmyInfo = (
  alive?: boolean,
  isMine?: boolean,
  battleEntityId?: ID,
  battleSide?: BattleSide,
): ArmyInfo => {
  return {
    entity_id: ARMY_ENTITY_ID,
    battle_id: battleEntityId ?? BATTLE_ENTITY_ID,
    battle_side: BattleSide[battleSide ?? BattleSide.Attack] ?? BattleSide[BattleSide.Attack],
    troops: {
      knight_count: alive ? ARMY_TROOP_COUNT : 0n,
      paladin_count: alive ? ARMY_TROOP_COUNT : 0n,
      crossbowman_count: 0n,
    },
    health: { entity_id: ARMY_ENTITY_ID, current: alive ? ARMY_INITIAL_HEALTH : 0n, lifetime: ARMY_INITIAL_HEALTH },
    name: "test army",
    isMine: isMine ?? false,
    isMercenary: false,
    isHome: false,
    offset: { x: 0, y: 0 },
    position: { entity_id: ARMY_ENTITY_ID, x: 0, y: 0 },
    owner: { entity_id: ARMY_ENTITY_ID, address: 0n },
    entityOwner: { entity_id: ARMY_ENTITY_ID, entity_owner_id: 0 },
    protectee: { army_id: ARMY_ENTITY_ID, protectee_id: 0 },
    movable: {
      entity_id: ARMY_ENTITY_ID,
      blocked: false,
      sec_per_km: 1,
      round_trip: false,
      start_coord_x: 0,
      start_coord_y: 0,
      intermediate_coord_x: 0,
      intermediate_coord_y: 0,
    },
    quantity: { entity_id: ARMY_ENTITY_ID, value: 0n },
    totalCapacity: 10n,
    weight: 0n,
    arrivalTime: { entity_id: ARMY_ENTITY_ID, arrives_at: 0n },
    stamina: { entity_id: ARMY_ENTITY_ID, amount: 1, last_refill_tick: 0n },
    realm: {
      entity_id: ARMY_ENTITY_ID,
      realm_id: 1,
      produced_resources: 1n,
      level: 1,
      order: 1,
      has_wonder: false,
      settler_address: 0n,
    },
    homePosition: { entity_id: ARMY_ENTITY_ID, x: 0, y: 0 },
  };
};

export const generateMockStructure = (structureType: StructureType, isMine?: boolean): Structure => {
  return {
    entity_id: 1,
    category: StructureType[structureType],
    isMine: isMine ?? false,
    created_at: 0n,
    isMercenary: false,
    name: "Mock Structure",
    protector: undefined,
    owner: {
      entity_id: 1,
      address: 0n,
    },
    entityOwner: {
      entity_id: 1,
      entity_owner_id: 0,
    },
  };
};

export const generateMockTroopConfig = () => {
  return {
    health: 1,
    knightStrength: 1,
    paladinStrength: 1,
    crossbowmanStrength: 1,
    advantagePercent: 1000,
    disadvantagePercent: 1000,
    maxTroopCount: 500000,
    pillageHealthDivisor: 8,
    baseArmyNumberForStructure: 3,
    armyExtraPerMilitaryBuilding: 1,
    maxArmiesPerStructure: 7,
    battleLeaveSlashNum: 25,
    battleLeaveSlashDenom: 100,
    battleTimeScale: 1000,
  };
};
