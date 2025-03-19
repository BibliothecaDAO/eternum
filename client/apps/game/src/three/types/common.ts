import { Position } from "@/types/position";
import { ID, StructureType, TroopTier, TroopType } from "@bibliothecadao/eternum";
import * as THREE from "three";

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
}

export interface MovingArmyData {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  matrixIndex: number;
  currentPathIndex: number;
}

export interface MovingLabelData {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
}

export interface RenderChunkSize {
  width: number;
  height: number;
}
