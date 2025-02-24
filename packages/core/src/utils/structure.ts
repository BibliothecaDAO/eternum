import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, Structure } from "..";
import { StructureType } from "../constants";
import { ClientComponents } from "../dojo";
import { ArmyInfo, ContractAddress, ID, Position, TickIds } from "../types";
import { getEntityName } from "./entities";
import { currentTickCount } from "./utils";

export const getStructureAtPosition = (
  { x, y }: Position,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  // todo: fix this
  const occupier = getComponentValue(components.Occupier, getEntityIdFromKeys([BigInt(x), BigInt(y)]));
  const structureEntity = getEntityIdFromKeys([BigInt(occupier?.occupier || 0n)]);

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

  // const protectorArmies = [
  //   structure.guards.alpha,
  //   structure.guards.bravo,
  //   structure.guards.charlie,
  //   structure.guards.delta,
  // ];
  const protectors: ArmyInfo[] = [];

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([structure.owner]));
  const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

  const name = getEntityName(structure.entity_id, components);

  return {
    entityId: structure.entity_id,
    structure,
    owner: structure.owner,
    name,
    position: { x: structure.base.coord_x, y: structure.base.coord_y },
    protectors,
    isMine: ContractAddress(structure.owner) === playerAddress,
    isMercenary: structure.owner === 0n,
    ownerName,
  };
};

export const isStructureImmune = (
  structure: { category: string; created_at: bigint } | undefined,
  currentTimestamp: number,
): boolean => {
  const structureType = StructureType[(structure?.category as keyof typeof StructureType) || 0];

  const tickCount = currentTickCount(currentTimestamp);
  const allowAttackTick =
    currentTickCount(Number(structure?.created_at || 0)) + configManager.getBattleGraceTickCount(structureType);

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};

export const getStructureImmunityTimer = (structure: Structure | undefined, currentBlockTimestamp: number) => {
  const structureType = structure?.structure.base.category as StructureType;

  const immunityEndTimestamp =
    Number(structure?.structure.base.created_at || 0) +
    (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};
