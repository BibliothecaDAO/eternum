import {
  formatCompactLabelNumber,
  resolveArmyTitle,
  resolveEntityLabelRelation,
  resolveStructureTitle,
  type EntityLabelVariant,
} from "../utils/labels/entity-label-view-model";
import type { ArmyData, StructureInfo } from "../types";

export type CompactEntityLabelVariant = EntityLabelVariant;

interface OwnershipLabelSource {
  isAlly?: boolean;
  isMine: boolean;
}

// Phase 3.3: the compact label is just the entity title. Resolve it directly instead
// of building the full view model (detailRows + objects) per moving army per frame.
export function resolveArmyCompactEntityLabel(army: Pick<ArmyData, "entityId" | "owner">): string {
  return resolveArmyTitle(army);
}

/** A structure's plate: its name; for a Frontier site, its kind and the strength of its guard, never its id. */
export function resolveStructureCompactEntityLabel(
  structure: Pick<StructureInfo, "entityId" | "structureName" | "structureType" | "siteKind" | "guardArmies">,
): string {
  if (structure.siteKind === undefined) return resolveStructureTitle(structure);
  const strength = (structure.guardArmies ?? []).reduce((total, guard) => total + guard.count, 0);
  return strength > 0 ? `${structure.siteKind} ${formatCompactLabelNumber(strength)}` : structure.siteKind;
}

export function resolveCompactEntityLabelVariant(input: OwnershipLabelSource): CompactEntityLabelVariant {
  return resolveEntityLabelRelation(input);
}
