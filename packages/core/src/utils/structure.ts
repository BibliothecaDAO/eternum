import { structureMapPosition } from "./expeditions";
import {
  StructureTypeToNameMapping,
  getMinePresentation,
  ESSENCE_RIFT_MINE_KIND,
  ContractAddress,
  ID,
  BANDITS_NAME,
  Structure,
  StructureType,
  TickIds,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { displayPlayerName, type PlayerNameResolver } from "./entities";
import { configManager } from "../managers";
import { currentTickCount } from "./utils";
import { isViewerOwner } from "./viewer";

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

/**
 * The mine kind a structure is drawn as. Frontier writes a discovered site as a Mine with no mine kind and records what
 * it is in its ExpeditionSite row (place_discovery skips the mine draw), so a Rift is drawn as the Essence Rift; a mine
 * with no site row is drawn by its own kind. Any other structure has no mine kind to draw.
 */
export const presentedMineKind = (
  store: Pick<NativeFactStore, "get">,
  structure: Pick<NativeRows["Structure"], "game_id" | "entity_id" | "base" | "metadata">,
): number | undefined => {
  if (structure.base.category !== StructureType.Mine) return undefined;
  const site = store.get("ExpeditionSite", { game_id: structure.game_id, entity_id: structure.entity_id });
  if (!site) return Number(structure.metadata.mine_kind);
  if (site.kind === "Rift") return ESSENCE_RIFT_MINE_KIND;
  throw new Error(`Mine ${structure.entity_id} is a ${site.kind} site, which is not drawn as a mine`);
};

export const getStructureTypeName = (structureType: StructureType, mineKind?: number) => {
  if (structureType === StructureType.Mine && mineKind !== undefined) return getMinePresentation(mineKind).name;
  return StructureTypeToNameMapping[structureType] ?? "Structure";
};
