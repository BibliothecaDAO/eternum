import { Position } from "@/types/position";
import { HexPosition, ID, QuestType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

export enum SceneName {
  WorldMap = "map",
  Hexception = "hex",
}

export enum HyperstructureTypesNames {
  STAGE_1 = "hyperstructure_stage0",
  STAGE_2 = "hyperstructure_stage1",
  STAGE_3 = "hyperstructure_stage2",
}

export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}

export interface StructureInfo {
  entityId: ID;
  hexCoords: { col: number; row: number };
  stage: number;
  initialized: boolean;
  level: number;
  isMine: boolean;
  isAlly: boolean;
  owner: { address: bigint; ownerName: string; guildName: string };
  structureType: StructureType;
  hasWonder: boolean;
}

export interface ArmyData {
  entityId: ID;
  matrixIndex: number;
  hexCoords: Position;
  isMine: boolean;
  isAlly: boolean;
  owner: { address: bigint; ownerName: string; guildName: string };
  order: string;
  color: string;
  category: TroopType;
  tier: TroopTier;
  isDaydreamsAgent: boolean;
}

export interface QuestData {
  entityId: ID;
  questType: QuestType;
  occupierId: ID;
  hexCoords: Position;
}

export interface ChestData {
  entityId: ID;
  hexCoords: Position;
}

export interface SelectableArmy {
  entityId: ID;
  position: HexPosition;
  name: string;
}

export interface RenderChunkSize {
  width: number;
  height: number;
}
