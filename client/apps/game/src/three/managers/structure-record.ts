import type { IncomingTroopArrival } from "@bibliothecadao/eternum";
import type { BuildingType, ID, StructureType } from "@bibliothecadao/types";
import type { CosmeticAttachmentTemplate } from "../cosmetics";
import type { StructureInfo } from "../types";

interface CreateStructureRecordInput {
  entityId: ID;
  structureName: string;
  hexCoords: { col: number; row: number };
  stage: number;
  initialized: boolean;
  level: number;
  owner: { address: bigint; ownerName: string; guildName: string };
  structureType: StructureType;
  hasWonder: boolean;
  attachments: CosmeticAttachmentTemplate[] | undefined;
  isAlly: boolean;
  isAddressMine: (address: bigint) => boolean;
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  incomingTroopArrivals?: IncomingTroopArrival[];
  hyperstructureRealmCount?: number;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

export function createStructureRecord(input: CreateStructureRecordInput): StructureInfo {
  return {
    entityId: input.entityId,
    structureName: input.structureName,
    hexCoords: input.hexCoords,
    stage: input.stage,
    initialized: input.initialized,
    level: input.level,
    isMine: input.isAddressMine(input.owner.address),
    owner: input.owner,
    structureType: input.structureType,
    hasWonder: input.hasWonder,
    attachments: input.attachments,
    isAlly: input.isAlly,
    guardArmies: input.guardArmies,
    activeProductions: input.activeProductions,
    incomingTroopArrivals: input.incomingTroopArrivals,
    hyperstructureRealmCount: input.hyperstructureRealmCount,
    attackedFromDegrees: input.attackedFromDegrees,
    attackedTowardDegrees: input.attackedTowardDegrees,
    battleCooldownEnd: input.battleCooldownEnd,
    battleTimerLeft: input.battleTimerLeft,
  };
}
