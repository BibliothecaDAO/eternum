import { Entity, getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
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
  const structureAtPosition = runQuery([HasValue(components.Position, { x, y }), Has(components.Structure)]);
  const structureEntity = Array.from(structureAtPosition)[0];

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
    position: structure.coord,
    protectors,
    isMine: ContractAddress(structure?.owner || 0n) === playerAddress,
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
  const structureType = StructureType[(structure?.structure.category as keyof typeof StructureType) || 0];

  const immunityEndTimestamp =
    Number(structure?.structure.created_at || 0) +
    (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};
