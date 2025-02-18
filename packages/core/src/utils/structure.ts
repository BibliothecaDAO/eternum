import { Entity, getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, Structure } from "..";
import { StructureType } from "../constants";
import { ClientComponents } from "../dojo";
import { ContractAddress, ID, Position, TickIds } from "../types";
import { getArmy } from "./army";
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

  const entityOwner = getComponentValue(components.EntityOwner, entity);
  if (!entityOwner) return;

  const position = getComponentValue(components.Position, entity);
  if (!position) return;

  const ownerOnChain = getComponentValue(
    components.Owner,
    getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]),
  );
  const owner = ownerOnChain ? ownerOnChain : { entity_id: structure.entity_id, address: ContractAddress(0n) };

  const protectorArmy = getComponentValue(components.Protector, entity);
  const protector = protectorArmy ? getArmy(protectorArmy.army_id, playerAddress, components) : undefined;

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([owner?.address]));
  const ownerName = addressName ? shortString.decodeShortString(addressName!.name.toString()) : "Bandits";

  const name = getEntityName(structure.entity_id, components);

  return {
    ...structure,
    entityId: structure.entity_id,
    entityOwner,
    owner,
    name,
    position,
    protector,
    isMine: ContractAddress(owner?.address || 0n) === playerAddress,
    isMercenary: owner.address === 0n,
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
  const structureType = StructureType[(structure?.category as keyof typeof StructureType) || 0];

  const immunityEndTimestamp =
    Number(structure?.created_at || 0) +
    (structure ? configManager.getBattleGraceTickCount(structureType) * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};
