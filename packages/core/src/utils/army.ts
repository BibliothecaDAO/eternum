import { Entity, getComponentValue, Has, HasValue, NotValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ArmyInfo, getArmyTotalCapacityInKg } from "..";
import { CapacityConfigCategory, RESOURCE_PRECISION } from "../constants";
import { ClientComponents } from "../dojo";
import { ContractAddress, ID } from "../types";

export const formatArmies = (
  armies: Entity[],
  playerAddress: ContractAddress,
  components: ClientComponents,
): ArmyInfo[] => {
  return armies
    .map((armyEntityId) => {
      const army = getComponentValue(components.Army, armyEntityId);
      if (!army) return undefined;

      const position = getComponentValue(components.Position, armyEntityId);
      if (!position) return undefined;

      const entityOwner = getComponentValue(components.EntityOwner, armyEntityId);
      if (!entityOwner) return undefined;

      const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));

      let health = structuredClone(getComponentValue(components.Health, armyEntityId));
      if (health) {
        health.current = health.current / BigInt(RESOURCE_PRECISION);
        health.lifetime = health.lifetime / BigInt(RESOURCE_PRECISION);
      } else {
        health = {
          entity_id: army.entity_id,
          current: 0n,
          lifetime: 0n,
        };
      }
      const protectee = getComponentValue(components.Protectee, armyEntityId);

      let quantity = structuredClone(getComponentValue(components.Quantity, armyEntityId));
      if (quantity) {
        quantity.value = BigInt(quantity.value) / BigInt(RESOURCE_PRECISION);
      } else {
        quantity = {
          entity_id: army.entity_id,
          value: 0n,
        };
      }

      const movable = getComponentValue(components.Movable, armyEntityId);

      const armyCapacityConfigEntityId = getEntityIdFromKeys([BigInt(CapacityConfigCategory.Army)]);
      const capacity = getComponentValue(components.CapacityConfig, armyCapacityConfigEntityId);
      const totalCapacity = capacity ? getArmyTotalCapacityInKg(army, capacity) : 0n;

      const weightComponentValue = getComponentValue(components.Weight, armyEntityId);
      const weight = weightComponentValue ? weightComponentValue.value / BigInt(RESOURCE_PRECISION) : 0n;

      const arrivalTime = getComponentValue(components.ArrivalTime, armyEntityId);
      const stamina = getComponentValue(components.Stamina, armyEntityId);
      const name = getComponentValue(components.EntityName, armyEntityId);
      const realm =
        entityOwner && getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
      const homePosition =
        realm && getComponentValue(components.Position, getEntityIdFromKeys([BigInt(realm.entity_id)]));

      const structure = getComponentValue(
        components.Structure,
        getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]),
      );

      const structurePosition =
        structure && getComponentValue(components.Position, getEntityIdFromKeys([BigInt(structure.entity_id)]));

      const isMine = (owner?.address || 0n) === playerAddress;
      const isMercenary = owner === undefined;

      const isHome = structurePosition && position.x === structurePosition.x && position.y === structurePosition.y;

      return {
        ...army,
        protectee,
        health,
        movable,
        quantity,
        totalCapacity,
        weight,
        arrivalTime,
        position,
        entityOwner,
        stamina,
        owner,
        realm,
        homePosition,
        isMine,
        isMercenary,
        isHome,
        name: name
          ? shortString.decodeShortString(name.name.toString())
          : `${protectee ? "🛡️" : "🗡️"}` + `Army ${army.entity_id}`,
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

export const getArmiesInBattle = (battleEntityId: ID, playerAddress: ContractAddress, components: ClientComponents) => {
  const armiesEntityIds = runQuery([
    Has(components.Army),
    NotValue(components.Health, { current: 0n }),
    NotValue(components.Army, { battle_id: 0 }),
    HasValue(components.Army, { battle_id: battleEntityId }),
  ]);

  const armies = formatArmies(Array.from(armiesEntityIds), playerAddress, components);

  return armies;
};

export const armyHasTroops = (entityArmies: (ArmyInfo | undefined)[]) => {
  return entityArmies.some(
    (army) =>
      army &&
      (Number(army.troops.knight_count) !== 0 ||
        Number(army.troops.crossbowman_count) !== 0 ||
        Number(army.troops.paladin_count) !== 0),
  );
};

export const armyHasTraveled = (entityArmies: ArmyInfo[], realmPosition: { x: number; y: number }) => {
  return entityArmies.some(
    (army) => army && realmPosition && (army.position.x !== realmPosition.x || army.position.y !== realmPosition.y),
  );
};
