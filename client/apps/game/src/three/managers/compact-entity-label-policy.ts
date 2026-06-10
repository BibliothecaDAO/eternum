import {
  buildArmyEntityLabelViewModel,
  buildStructureEntityLabelViewModel,
  resolveEntityLabelRelation,
  type EntityLabelVariant,
} from "../utils/labels/entity-label-view-model";
import type { ArmyData, StructureInfo } from "../types";

export type CompactEntityLabelVariant = EntityLabelVariant;

interface OwnershipLabelSource {
  isAlly?: boolean;
  isDaydreamsAgent?: boolean;
  isMine: boolean;
}

export function resolveArmyCompactEntityLabel(army: Pick<ArmyData, "entityId" | "owner">): string {
  return buildArmyEntityLabelViewModel(army).compactText;
}

export function resolveStructureCompactEntityLabel(
  structure: Pick<StructureInfo, "entityId" | "structureName" | "structureType">,
): string {
  return buildStructureEntityLabelViewModel({
    ...structure,
    activeProductions: [],
    guardArmies: [],
    isAlly: false,
    isMine: false,
    owner: { address: 0n, guildName: "", ownerName: "" },
  }).compactText;
}

export function resolveCompactEntityLabelVariant(input: OwnershipLabelSource): CompactEntityLabelVariant {
  return resolveEntityLabelRelation(input);
}
