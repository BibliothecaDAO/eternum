import { ComponentValue, Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ArmyInfo, divideByPrecision, getArmyTotalCapacityInKg, ResourcesIds } from "..";
import { ClientComponents } from "../dojo";
import { ContractAddress, ID, TroopTier, TroopType } from "../types";

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

      const totalCapacity = getArmyTotalCapacityInKg(divideByPrecision(Number(explorerTroops.troops.count)));

      const resource = getComponentValue(components.Resource, armyEntityId);
      const weight = resource ? resource.weight.weight : 0n;

      const stamina = explorerTroops.troops.stamina.amount;
      const name = getComponentValue(components.AddressName, armyEntityId);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(explorerTroops.owner)]));

      const isMine = (structure?.owner || 0n) === playerAddress;

      const isMercenary = structure?.owner === 0n;

      const isHome = structure && position.x === structure.base.coord_x && position.y === structure.base.coord_y;

      return {
        entityId: explorerTroops.explorer_id,
        troops: explorerTroops.troops,
        totalCapacity,
        weight,
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
      return ResourcesIds.Knight;
    case TroopType.Crossbowman:
      return ResourcesIds.Crossbowman;
    case TroopType.Paladin:
      return ResourcesIds.Paladin;
  }
};

export const getGuardsByStructure = (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
  if (!structure?.troop_guards) return [];

  // Extract guard troops from the structure
  const guards = [
    {
      slot: 0,
      troops: structure.troop_guards.delta,
      destroyedTick: structure.troop_guards.delta_destroyed_tick,
    },
    {
      slot: 1,
      troops: structure.troop_guards.charlie,
      destroyedTick: structure.troop_guards.charlie_destroyed_tick,
    },
    {
      slot: 2,
      troops: structure.troop_guards.bravo,
      destroyedTick: structure.troop_guards.bravo_destroyed_tick,
    },
    {
      slot: 3,
      troops: structure.troop_guards.alpha,
      destroyedTick: structure.troop_guards.alpha_destroyed_tick,
    },
  ];

  // Filter out guards with no troops
  return guards.filter((guard) => guard.troops.count > 0n);
};
