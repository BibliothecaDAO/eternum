import {
  type ArmyInfo,
  type ClientComponents,
  type ContractAddress,
  type Direction,
  getNeighborHexes,
  GuardSlot,
  type ID,
  ResourcesIds,
  TickIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { type ComponentValue, type Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { configManager, divideByPrecision, getAddressNameFromEntity, getArmyName, gramToKg, nanogramToKg, getTileAt, DEFAULT_COORD_ALT } from "..";

export const formatArmies = (
  armies: Entity[],
  playerAddress: ContractAddress,
  components: ClientComponents,
): ArmyInfo[] => {
  return armies
    .map((armyEntity) => {
      const explorerTroops = getComponentValue(components.ExplorerTroops, armyEntity);
      if (!explorerTroops) return undefined;

      const position = explorerTroops.coord;

      const resource = getComponentValue(components.Resource, armyEntity);
      const totalCapacityKg = resource ? getArmyTotalCapacityInKg(resource) : 0;
      const weightKg = resource ? gramToKg(divideByPrecision(Number(resource.weight.weight))) : 0;

      const stamina = explorerTroops.troops.stamina.amount;
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(explorerTroops.owner)]));

      const isMine = (structure?.owner || 0n) === playerAddress;

      const isMercenary = structure?.owner === 0n;

      const isHome = structure && isArmyAdjacentToStructure(position, structure.base.coord_x, structure.base.coord_y);

      const hasAdjacentStructure = hasAdjacentOwnedStructure(position, playerAddress, components);

      return {
        entityId: explorerTroops.explorer_id,
        troops: explorerTroops.troops,
        totalCapacity: totalCapacityKg,
        weight: weightKg,
        position,
        entity_owner_id: explorerTroops.owner,
        stamina,
        owner: structure?.owner,
        ownerName: getAddressNameFromEntity(explorerTroops.owner, components) || "",
        structure,
        explorer: explorerTroops,
        isMine,
        isMercenary,
        isHome,
        name: getArmyName(explorerTroops.explorer_id),
        hasAdjacentStructure,
      };
    })
    .filter((army): army is ArmyInfo => army !== undefined);
};

export const getArmy = (
  armyEntityId: ID | Entity,
  playerAddress: ContractAddress,
  components: ClientComponents,
): ArmyInfo | undefined => {
  const entityId = typeof armyEntityId === "string" ? armyEntityId : getEntityIdFromKeys([BigInt(armyEntityId)]);
  return formatArmies([entityId], playerAddress, components)[0];
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some((army) => army && army.troops.count !== 0n);
};

export const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  return entityArmies.some(
    (army) => army && realmPosition && (army.position.x !== realmPosition.x || army.position.y !== realmPosition.y),
  );
};

export const getTroopName = (troopType: TroopType, troopTier: TroopTier): string => {
  switch (troopTier) {
    case TroopTier.T1:
      switch (troopType) {
        case TroopType.Knight:
          return "Footman";
        case TroopType.Crossbowman:
          return "Archer";
        case TroopType.Paladin:
          return "Horseman";
      }
    case TroopTier.T2:
      switch (troopType) {
        case TroopType.Knight:
          return "Knight";
        case TroopType.Crossbowman:
          return "Crossbowman";
        case TroopType.Paladin:
          return "Paladin";
      }
    case TroopTier.T3:
      switch (troopType) {
        case TroopType.Knight:
          return "Royal Guardian";
        case TroopType.Crossbowman:
          return "Beast Hunter";
        case TroopType.Paladin:
          return "Dragon Rider";
      }
  }
};

export const getTroopResourceId = (troopType: TroopType, troopTier: TroopTier): ResourcesIds => {
  switch (troopType) {
    case TroopType.Knight:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Knight;
        case TroopTier.T2:
          return ResourcesIds.KnightT2;
        case TroopTier.T3:
          return ResourcesIds.KnightT3;
      }
    case TroopType.Crossbowman:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Crossbowman;
        case TroopTier.T2:
          return ResourcesIds.CrossbowmanT2;
        case TroopTier.T3:
          return ResourcesIds.CrossbowmanT3;
      }
    case TroopType.Paladin:
      switch (troopTier) {
        case TroopTier.T1:
          return ResourcesIds.Paladin;
        case TroopTier.T2:
          return ResourcesIds.PaladinT2;
        case TroopTier.T3:
          return ResourcesIds.PaladinT3;
      }
  }
};

export const getGuardsByStructure = (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
  if (!structure?.troop_guards) return [];

  const guardResurrectionDelay = configManager.getTroopConfig().troop_limit_config.guard_resurrection_delay;

  const armiesTickInSeconds = configManager.getTick(TickIds.Armies);

  // Extract guard troops from the structure
  const guards = [
    {
      slot: GuardSlot.Delta,
      troops: structure.troop_guards.delta,
      destroyedTick: structure.troop_guards.delta_destroyed_tick,
      cooldownEnd: structure.troop_guards.delta_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: GuardSlot.Charlie,
      troops: structure.troop_guards.charlie,
      destroyedTick: structure.troop_guards.charlie_destroyed_tick,
      cooldownEnd: structure.troop_guards.charlie_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: GuardSlot.Bravo,
      troops: structure.troop_guards.bravo,
      destroyedTick: structure.troop_guards.bravo_destroyed_tick,
      cooldownEnd: structure.troop_guards.bravo_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: GuardSlot.Alpha,
      troops: structure.troop_guards.alpha,
      destroyedTick: structure.troop_guards.alpha_destroyed_tick,
      cooldownEnd: structure.troop_guards.alpha_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
  ];

  // Filter out guards with no troops
  return guards;
};

export const hasAdjacentOwnedStructure = (
  position: { x: number; y: number },
  playerAddress: ContractAddress,
  components: ClientComponents,
) => {
  const neighborHexes = getNeighborHexes(position.x, position.y);
  for (const hex of neighborHexes) {
    const tile = getTileAt(components, DEFAULT_COORD_ALT, hex.col, hex.row);
    if (!tile?.occupier_is_structure) continue;
    const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(tile.occupier_id)]));
    if (!structure) continue;
    if (structure.owner === playerAddress) {
      return true;
    }
  }
  return false;
};

export const isArmyAdjacentToStructure = (
  armyPosition: { x: number; y: number },
  structureX: number,
  structureY: number,
): boolean => {
  const adjacentHexes = getNeighborHexes(structureX, structureY);
  return adjacentHexes.some((hex) => hex.col === armyPosition.x && hex.row === armyPosition.y);
};

export const getFreeDirectionsAroundStructure = (structureEntityId: ID, components: ClientComponents) => {
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureEntityId)]));

  const freeDirections: Direction[] = [];

  if (!structure) return freeDirections;

  const adjacentHexes = getNeighborHexes(structure.base.coord_x, structure.base.coord_y);

  adjacentHexes.forEach((hex) => {
    const tile = getTileAt(components, DEFAULT_COORD_ALT, hex.col, hex.row);

    if (tile?.occupier_id === 0) {
      freeDirections.push(hex.direction);
    }
  });

  return freeDirections;
};

// troop count without precision
export const getRemainingCapacityInKg = (resource: ComponentValue<ClientComponents["Resource"]["schema"]>) => {
  const weight = resource?.weight;

  if (!weight) return 0;

  return nanogramToKg(Number(weight.capacity - weight.weight)) || 0;
};

// number of troops needs to be divided by precision
export const getArmyTotalCapacityInKg = (resource: ComponentValue<ClientComponents["Resource"]["schema"]>) => {
  const totalCapacity = resource?.weight.capacity;

  return nanogramToKg(Number(totalCapacity)) || 0;
};
