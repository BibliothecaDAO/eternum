import {
  StructureTypeToNameMapping,
  getMinePresentation,
  ContractAddress,
  ID,
  BANDITS_NAME,
  Position,
  Structure,
  StructureType,
  TickIds,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { shortString } from "starknet";
import { getTileAt } from "./tile";
import { configManager } from "../managers";
import { currentTickCount } from "./utils";

export const getStructureAtPosition = (
  { x, y, alt }: Position,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): Structure | undefined => {
  const tile = getTileAt(store, alt, x, y);
  return tile?.occupier_is_structure ? getStructure(tile.occupier_id, playerAddress, store) : undefined;
};

export const getStructure = (
  entityId: ID,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): Structure | undefined => {
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  if (!structure) return undefined;
  const addressName = store.get("AddressName", { address: structure.owner });
  return {
    entityId,
    structure,
    owner: structure.owner,
    position: { alt: structure.base.alt, x: structure.base.coord_x, y: structure.base.coord_y },
    isMine: structure.owner === playerAddress,
    isMercenary: structure.owner === 0n,
    ownerName: addressName ? shortString.decodeShortString(addressName.name.toString()) : BANDITS_NAME,
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
  structure: NativeRows["Structure"] | undefined,
  currentBlockTimestamp: number,
) => {
  const seasonMainGameStartAt = configManager.getSeasonMainGameStartAt();
  const immunityEndTimestamp =
    Number(seasonMainGameStartAt) +
    (structure ? configManager.getBattleGraceTickCount() * configManager.getTick(TickIds.Armies) : 0);

  if (!currentBlockTimestamp) return 0;
  return immunityEndTimestamp - currentBlockTimestamp!;
};

export const getStructureTypeName = (structureType: StructureType, mineKind?: number) => {
  if (structureType === StructureType.Mine && mineKind !== undefined) return getMinePresentation(mineKind).name;
  return StructureTypeToNameMapping[structureType] ?? "Structure";
};
