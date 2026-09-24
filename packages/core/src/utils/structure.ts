import { structureMapPosition } from "./expeditions";
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
import { displayPlayerName, type PlayerNameResolver } from "./entities";
import { getTileAt } from "./tile";
import { configManager } from "../managers";
import { currentTickCount } from "./utils";
import { isViewerOwner } from "./viewer";

export const getStructureAtPosition = (
  { x, y, alt }: Position,
  playerAddress: ContractAddress | null,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): Structure | undefined => {
  const tile = getTileAt(store, alt, x, y);
  return tile?.occupier_is_structure ? getStructure(tile.occupier_id, playerAddress, store, playerName) : undefined;
};

export const getStructure = (
  entityId: ID,
  playerAddress: ContractAddress | null,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): Structure | undefined => {
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  if (!structure) return undefined;
  return {
    entityId,
    structure,
    owner: structure.owner,
    position: structureMapPosition(store, structure),
    isMine: isViewerOwner(structure.owner, playerAddress),
    isMercenary: structure.owner === 0n,
    ownerName: structure.owner === 0n ? BANDITS_NAME : displayPlayerName(structure.owner, playerName(structure.owner)),
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
