import { BuildingType, TroopTier, TroopType } from "@bibliothecadao/types";

export interface MapObject {
  id: number;
  col: number;
  row: number;
  owner?: bigint;
  type: string;
}

export interface ArmyObject extends MapObject {
  type: "army";
  strength?: number;
  isMoving?: boolean;
  targetCol?: number;
  targetRow?: number;
  troopType?: TroopType;
  troopTier?: TroopTier;
  ownerName?: string;
  guildName?: string;
  isDaydreamsAgent?: boolean;
  isAlly?: boolean;
  troopCount?: number;
  currentStamina?: number;
  maxStamina?: number;
}

export interface StructureObject extends MapObject {
  type: "structure";
  structureType?: string;
  level?: number;
  buildingType?: BuildingType;
}

export interface QuestObject extends MapObject {
  type: "quest";
  questType?: string;
  isCompleted?: boolean;
}

export interface ChestObject extends MapObject {
  type: "chest";
}

export type GameMapObject = ArmyObject | StructureObject | QuestObject | ChestObject;
