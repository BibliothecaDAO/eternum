import { Position } from "@bibliothecadao/eternum";

import { BuildingType, ID, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import type { CosmeticAttachmentTemplate } from "../cosmetics/types";

export enum SceneName {
  WorldMap = "map",
  Hexception = "hex",
}

export enum HyperstructureTypesNames {
  STAGE_1 = "hyperstructure_stage0",
  STAGE_2 = "hyperstructure_stage1",
  STAGE_3 = "hyperstructure_stage2",
}

export interface StructureInfo {
  structureName: string;
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
  cosmeticId?: string;
  attachments?: CosmeticAttachmentTemplate[];
  // Enhanced data from MapDataStore
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  hyperstructureRealmCount?: number;
  attackedFromDegrees?: number; // Degrees from which this structure has been attacked
  attackedTowardDegrees?: number; // Degrees in which this structure has attacked someone
  battleCooldownEnd?: number; // Unix timestamp when battle cooldown ends
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
}

export interface ArmyData {
  entityId: ID;
  matrixIndex?: number;
  hexCoords: Position;
  isMine: boolean;
  owningStructureId: ID | null;
  owner: { address: bigint; ownerName: string; guildName: string };
  color: string;
  category: TroopType;
  tier: TroopTier;
  isDaydreamsAgent: boolean;
  cosmeticId?: string;
  attachments?: CosmeticAttachmentTemplate[];
  // Enhanced data from MapDataStore
  troopCount: number;
  currentStamina: number;
  maxStamina: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  attackedFromDegrees?: number; // Degrees from which this army has been attacked
  attackedTowardDegrees?: number; // Degrees in which this army has attacked someone
  battleCooldownEnd?: number; // Unix timestamp when battle cooldown ends
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
}

export interface RenderChunkSize {
  width: number;
  height: number;
}
