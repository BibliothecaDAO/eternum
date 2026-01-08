import {
  BlitzStructureTypeToNameMapping,
  ClientComponents,
  ContractAddress,
  EternumStructureTypeToNameMapping,
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
import { getTileAt, DEFAULT_COORD_ALT } from "./tile";
import { configManager } from "../managers";
import { currentTickCount } from "./utils";

export const getStructureAtPosition = (
  { x, y }: Position,
  playerAddress: ContractAddress,
  components: ClientComponents,
): Structure | undefined => {
  const tile = getTileAt(components, DEFAULT_COORD_ALT, x, y);
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

  return {
    entityId: structure.entity_id,
    structure,
    owner: structure.owner,
    position: { alt: DEFAULT_COORD_ALT, x: structure.base.coord_x, y: structure.base.coord_y },
    isMine: ContractAddress(structure.owner) === playerAddress,
    isMercenary: structure.owner === 0n,
    ownerName,
    category: structure.base.category,
  };
};

export const isStructureImmune = (currentTimestamp: number): boolean => {
  const tickCount = currentTickCount(currentTimestamp);
  const seasonMainGameStartAt = configManager.getSeasonMainGameStartAt();
  const allowAttackTick = currentTickCount(Number(seasonMainGameStartAt)) + configManager.getBattleGraceTickCount();

  if (tickCount < allowAttackTick) {
    return true;
  }
  return false;
};

export const getStructureImmunityTimer = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | undefined,
  currentBlockTimestamp: number,
) => {
  const seasonMainGameStartAt = configManager.getSeasonMainGameStartAt();
  const immunityEndTimestamp =
    Number(seasonMainGameStartAt) +
    (structure ? configManager.getBattleGraceTickCount() * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};

export const getStructureTypeName = (structureType: StructureType, isBlitz: boolean) => {
  return isBlitz ? BlitzStructureTypeToNameMapping[structureType] : EternumStructureTypeToNameMapping[structureType];
};
