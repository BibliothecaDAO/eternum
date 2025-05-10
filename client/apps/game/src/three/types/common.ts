import { Position } from "@/types/position";
import { ContractAddress, ID, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

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
  owner: { address: bigint; ownerName: string; guildName: string };
  structureType: StructureType;
  hasWonder: boolean;
}

export interface ArmyData {
  entityId: ID;
  matrixIndex: number;
  hexCoords: Position;
  isMine: boolean;
  owner: { address: bigint; ownerName: string; guildName: string };
  order: string;
  color: string;
  category: TroopType;
  tier: TroopTier;
  isDaydreamsAgent: boolean;
}

export interface QuestData {
  entityId: ID;
  id: ID;
  game_address: ContractAddress;
  hexCoords: Position;
  level: number;
  resource_type: number;
  amount: bigint;
  capacity: number;
  participant_count: number;
}

export interface RenderChunkSize {
  width: number;
  height: number;
}
