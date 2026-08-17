import {
  resolveArmyTitle,
  resolveEntityLabelRelation,
  resolveStructureTitle,
  type EntityLabelVariant,
} from "../utils/labels/entity-label-view-model";
import type { ArmyData, StructureInfo } from "../types";

export type CompactEntityLabelVariant = EntityLabelVariant;

interface OwnershipLabelSource {
  isAlly?: boolean;
  isDaydreamsAgent?: boolean;
  isMine: boolean;
}

// Phase 3.3: the compact label is just the entity title. Resolve it directly instead
// of building the full view model (detailRows + objects) per moving army per frame.
export function resolveArmyCompactEntityLabel(army: Pick<ArmyData, "entityId" | "owner">): string {
  return resolveArmyTitle(army);
}

export function resolveStructureCompactEntityLabel(
  structure: Pick<StructureInfo, "entityId" | "structureName" | "structureType">,
): string {
  return resolveStructureTitle(structure);
}

export function resolveCompactEntityLabelVariant(input: OwnershipLabelSource): CompactEntityLabelVariant {
  return resolveEntityLabelRelation(input);
}
