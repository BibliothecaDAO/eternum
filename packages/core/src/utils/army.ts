import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ArmyInfo, getArmyTotalCapacityInKg } from "..";
import { ClientComponents } from "../dojo";
import { ContractAddress, ID, TroopInfo, TroopsLegacy, TroopType } from "../types";

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

      const totalCapacity = getArmyTotalCapacityInKg(Number(explorerTroops.troops.count));

      const resource = getComponentValue(components.Resource, armyEntityId);
      const weight = resource ? resource.weight : 0n;

      const stamina = explorerTroops.troops.stamina.amount;
      const name = getComponentValue(components.AddressName, armyEntityId);
      const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(explorerTroops.explorer_id)]));
      const structure = getComponentValue(
        components.Structure,
        getEntityIdFromKeys([BigInt(explorerTroops.explorer_id)]),
      );

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
        realm,
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

export const getDominantTroopInfo = (troops: TroopsLegacy): TroopInfo => {
  const { knight_count, crossbowman_count, paladin_count } = troops;

  if (knight_count >= crossbowman_count && knight_count >= paladin_count) {
    return { type: TroopType.Knight, count: Number(knight_count), label: "Knights" };
  }
  if (crossbowman_count >= knight_count && crossbowman_count >= paladin_count) {
    return { type: TroopType.Crossbowman, count: Number(crossbowman_count), label: "Crossbowmen" };
  }
  return { type: TroopType.Paladin, count: Number(paladin_count), label: "Paladins" };
};
