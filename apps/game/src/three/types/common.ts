import { Position } from "@bibliothecadao/eternum";
import type { IncomingTroopArrival, SiteKind } from "@bibliothecadao/eternum";

import { BuildingType, ID, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import type { CosmeticAttachmentTemplate } from "../cosmetics/types";
import type { FrontierBeast } from "../structures/frontier-beast";

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
  mineKind?: number;
  hasWonder: boolean;
  /** A guarded Frontier site's kind (its ExpeditionSite stands): its plate reads kind and strength, never an id. */
  siteKind?: SiteKind;
  clearedSite?: true;
  /** The standing site's beast identity shared by its model and plate. */
  frontierBeast?: FrontierBeast;
  realmOrder?: number;
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
  usesFallbackCosmeticSkin?: boolean;
  attachments?: CosmeticAttachmentTemplate[];
  // Live presentation facts derived from native store
  guardArmies?: Array<{
    slot: number;
    category: string | null;
    tier: number;
    count: number;
    /** The slot's stamina, now and at most, where it is read (the battle preview's guard stamina, at the chain's tick). */
    stamina?: { current: number; max: number };
  }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  incomingTroopArrivals?: IncomingTroopArrival[];
  attackedFromDegrees?: number; // Degrees from which this structure has been attacked
  attackedTowardDegrees?: number; // Degrees in which this structure has attacked someone
  battleCooldownEnd?: number; // Unix timestamp when battle cooldown ends
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
}

export interface ArmyData {
  entityId: ID;
  hexCoords: Position;
  isMine: boolean;
  owningStructureId: ID | null;
  owner: { address: bigint; ownerName: string; guildName: string };
  color: string;
  category: TroopType;
  tier: TroopTier;
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
  usesFallbackCosmeticSkin?: boolean;
  attachments?: CosmeticAttachmentTemplate[];
  // Live presentation facts derived from native store
  troopCount: number;
  currentStamina: number | undefined;
  maxStamina: number;
  attackedFromDegrees?: number; // Degrees from which this army has been attacked
  attackedTowardDegrees?: number; // Degrees in which this army has attacked someone
  battleCooldownEnd?: number; // Unix timestamp when battle cooldown ends
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
  foodBlocked?: boolean; // Own army whose realm cannot pay a step's food (see readArmyMovementReadiness)
}

export interface RenderChunkSize {
  width: number;
  height: number;
}
