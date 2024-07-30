import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { BattleSide, StructureType } from "@bibliothecadao/eternum";

export const CURRENT_TIMESTAMP = 2;
export const DURATION_LEFT_IF_ONGOING = 1000n;
export const LAST_UPDATED = 0n;

export const ARMY_ENTITY_ID = 1n;
export const BATTLE_ENTITY_ID = 10n;

const getTroopHeathSimplified = (troopCount: bigint): bigint => {
  return troopCount * 2n;
};

export const BATTLE_TROOP_COUNT = 10n;
export const BATTLE_INITIAL_HEALTH = getTroopHeathSimplified(BATTLE_TROOP_COUNT);

export const ARMY_TROOP_COUNT = 5n;
export const ARMY_INITIAL_HEALTH = getTroopHeathSimplified(ARMY_TROOP_COUNT);

export const generateMockBatle = (isOngoing: boolean, lastUpdated?: number, loser?: BattleSide) => {
  return {
    entity_id: BATTLE_ENTITY_ID,
    attack_army: {
      troops: { knight_count: BATTLE_TROOP_COUNT, paladin_count: BATTLE_TROOP_COUNT, crossbowman_count: 0n },
      battle_id: 0n,
      battle_side: 0,
    },
    defence_army: {
      troops: { knight_count: BATTLE_TROOP_COUNT, paladin_count: BATTLE_TROOP_COUNT, crossbowman_count: 0n },
      battle_id: 0n,
      battle_side: 0,
    },
    attack_army_lifetime: {
      troops: {
        knight_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        paladin_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        crossbowman_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
      },
      battle_id: 0n,
      battle_side: 0,
    },
    defence_army_lifetime: {
      troops: {
        knight_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        paladin_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
        crossbowman_count: isOngoing ? 2n * BATTLE_TROOP_COUNT : BATTLE_TROOP_COUNT,
      },
      battle_id: 0n,
      battle_side: 0,
    },
    attackers_resources_escrow_id: 0n,
    defenders_resources_escrow_id: 0n,
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
  };
};

export const generateMockArmyInfo = (alive?: boolean, isMine?: boolean, battleId?: bigint): ArmyInfo => {
  return {
    entity_id: ARMY_ENTITY_ID,
    battle_id: battleId ?? BATTLE_ENTITY_ID,
    battle_side: BattleSide[BattleSide.Attack],
    troops: {
      knight_count: alive ? ARMY_TROOP_COUNT : 0n,
      paladin_count: alive ? ARMY_TROOP_COUNT : 0n,
      crossbowman_count: 0n,
    },
    health: { entity_id: ARMY_ENTITY_ID, current: alive ? ARMY_INITIAL_HEALTH : 0n, lifetime: ARMY_INITIAL_HEALTH },
    name: "test army",
    isMine: isMine ?? false,
    isMercenary: false,
    uiPos: { x: 0, y: 0, z: 0 },
    offset: { x: 0, y: 0 },
    position: { entity_id: ARMY_ENTITY_ID, x: 0, y: 0 },
    owner: { entity_id: ARMY_ENTITY_ID, address: 0n },
    entityOwner: { entity_id: ARMY_ENTITY_ID, entity_owner_id: 0n },
    protectee: { army_id: ARMY_ENTITY_ID, protectee_id: 0n },
    quantity: { entity_id: ARMY_ENTITY_ID, value: 10n },
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
    capacity: { entity_id: ARMY_ENTITY_ID, weight_gram: 10n },
    weight: { entity_id: ARMY_ENTITY_ID, value: 0n },
    arrivalTime: { entity_id: ARMY_ENTITY_ID, arrives_at: 0 },
    stamina: { entity_id: ARMY_ENTITY_ID, amount: 1, last_refill_tick: 0 },
    realm: {
      entity_id: ARMY_ENTITY_ID,
      realm_id: 1n,
      resource_types_packed: 1n,
      resource_types_count: 1,
      cities: 1,
      harbors: 1,
      rivers: 1,
      regions: 1,
      wonder: 1,
      order: 1,
    },
    homePosition: { entity_id: ARMY_ENTITY_ID, x: 0, y: 0 },
  };
};

export const generateMockStructure = (structureType: StructureType, isMine?: boolean) => {
  return {
    entity_id: 1n,
    category: StructureType[structureType],
    isMine: isMine ?? false,
    isMercenary: false,
    name: "Mock Structure",
    protector: undefined,
    owner: {
      entity_id: 1n,
      address: 0n,
    },
    entityOwner: {
      entity_id: 1n,
      entity_owner_id: 0n,
    },
  };
};
