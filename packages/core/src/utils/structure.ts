import {
  ClientComponents,
  ContractAddress,
  ID,
  MERCENARIES,
  Position,
  Structure,
  StructureType,
  TickIds,
} from "@bibliothecadao/types";
import { ComponentValue, Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager } from "../managers";
import { getEntityName } from "./entities";
import { currentTickCount } from "./utils";

export const getStructureAtPosition = (
  { x, y }: Position,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const tile = getComponentValue(components.Tile, getEntityIdFromKeys([BigInt(x), BigInt(y)]));
  const structureEntity = getEntityIdFromKeys([BigInt(tile?.occupier_id || 0n)]);

  if (!structureEntity) return;

  return getStructureInfo(structureEntity, playerAddress, components);
};

export const getStructure = (
  entityId: Entity | ID,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const structureEntity = typeof entityId === "string" ? entityId : getEntityIdFromKeys([BigInt(entityId)]);
  return getStructureInfo(structureEntity, playerAddress, components);
};

const getStructureInfo = (
  entity: Entity,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const structure = getComponentValue(components.Structure, entity);
  if (!structure) return;

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([structure.owner]));
  const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : MERCENARIES;

  const name = getEntityName(structure.entity_id, components);

  return {
    entityId: structure.entity_id,
    structure,
    owner: structure.owner,
    name,
    position: { x: structure.base.coord_x, y: structure.base.coord_y },
    isMine: ContractAddress(structure.owner) === playerAddress,
    isMercenary: structure.owner === 0n,
    ownerName,
    category: structure.base.category,
  };
};

export const isStructureImmune = (
  structure: { category: number; created_at: number } | undefined,
  currentTimestamp: number,
): boolean => {
  const structureType = structure?.category as StructureType;

  const tickCount = currentTickCount(currentTimestamp);
  const allowAttackTick =
    currentTickCount(Number(structure?.created_at || 0)) + configManager.getBattleGraceTickCount(structureType);

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};

export const getStructureImmunityTimer = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | undefined,
  currentBlockTimestamp: number,
) => {
  const structureType = structure?.base.category as StructureType;

  const immunityEndTimestamp =
    Number(structure?.base.created_at || 0) +
    (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};

export const getStructureTypeName = (structureType: StructureType) => {
  switch (structureType) {
    case StructureType.Bank:
      return "Bank";
    case StructureType.Hyperstructure:
      return "Hyperstructure";
    case StructureType.FragmentMine:
      return "Fragment Mine";
    case StructureType.Village:
      return "Village";
    case StructureType.Realm:
      return "Realm";
    default:
      return "Unknown";
  }
};
