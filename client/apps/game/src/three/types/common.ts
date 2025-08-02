import { Position } from "@/types/position";
import { BuildingType, HexPosition, ID, QuestType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

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
  // Enhanced data from MapDataStore
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
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
  // Enhanced data from MapDataStore
  troopCount: number;
  currentStamina: number;
  maxStamina: number;
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
