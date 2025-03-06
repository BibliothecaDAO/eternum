import { ComponentValue, Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ArmyInfo, configManager, divideByPrecision, getArmyTotalCapacityInKg, gramToKg, ResourcesIds } from "..";
import { ClientComponents } from "../dojo";
import { ContractAddress, ID, TickIds, TroopTier, TroopType } from "../types";

export const formatArmies = (
  armies: Entity[],
  playerAddress: ContractAddress,
  components: ClientComponents,
): ArmyInfo[] => {
  return armies
    .map((armyEntityId) => {
      const explorerTroops = getComponentValue(components.ExplorerTroops, armyEntityId);
      if (!explorerTroops) return undefined;

      const position = explorerTroops.coord;

      const totalCapacityKg = Number(getArmyTotalCapacityInKg(divideByPrecision(Number(explorerTroops.troops.count))));

      const resource = getComponentValue(components.Resource, armyEntityId);
      const weightKg = resource ? gramToKg(divideByPrecision(Number(resource.weight.weight))) : 0;

      const stamina = explorerTroops.troops.stamina.amount;
      const name = getComponentValue(components.AddressName, armyEntityId);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(explorerTroops.owner)]));

      const isMine = (structure?.owner || 0n) === playerAddress;

      const isMercenary = structure?.owner === 0n;

      const isHome = structure && position.x === structure.base.coord_x && position.y === structure.base.coord_y;

      return {
        entityId: explorerTroops.explorer_id,
        troops: explorerTroops.troops,
        totalCapacity: totalCapacityKg,
        weight: weightKg,
        position,
        entity_owner_id: explorerTroops.owner,
        stamina,
        owner: structure?.owner,
        structure,
        isMine,
        isMercenary,
        isHome,
        name: name ? shortString.decodeShortString(name.name.toString()) : `Army ${explorerTroops.explorer_id}`,
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
      slot: 0,
      troops: structure.troop_guards.delta,
      destroyedTick: structure.troop_guards.delta_destroyed_tick,
      // timestamp
      cooldownEnd: structure.troop_guards.delta_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: 1,
      troops: structure.troop_guards.charlie,
      destroyedTick: structure.troop_guards.charlie_destroyed_tick,
      cooldownEnd: structure.troop_guards.charlie_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: 2,
      troops: structure.troop_guards.bravo,
      destroyedTick: structure.troop_guards.bravo_destroyed_tick,
      cooldownEnd: structure.troop_guards.bravo_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
    {
      slot: 3,
      troops: structure.troop_guards.alpha,
      destroyedTick: structure.troop_guards.alpha_destroyed_tick,
      cooldownEnd: structure.troop_guards.alpha_destroyed_tick * armiesTickInSeconds + guardResurrectionDelay,
    },
  ];

  // Filter out guards with no troops
  return guards;
};
