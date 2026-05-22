import { getGameModeConfig } from "@/config/game-modes";
import { StructureType } from "@bibliothecadao/types";
import type { ArmyData, StructureInfo } from "../types";

export type CompactEntityLabelVariant = "agent" | "ally" | "enemy" | "mine" | "neutral" | "structure";

interface OwnershipLabelSource {
  isAlly?: boolean;
  isDaydreamsAgent?: boolean;
  isMine: boolean;
}

export function resolveArmyCompactEntityLabel(army: Pick<ArmyData, "entityId" | "owner">): string {
  const ownerName = army.owner.ownerName.trim();
  return ownerName.length > 0 ? ownerName : `Army #${army.entityId}`;
}

export function resolveStructureCompactEntityLabel(
  structure: Pick<StructureInfo, "entityId" | "structureName" | "structureType">,
): string {
  const structureName = structure.structureName.trim();
  if (structureName.length > 0) {
    return structureName;
  }

  return `${resolveStructureTypeLabel(structure.structureType)} #${structure.entityId}`;
}

export function resolveCompactEntityLabelVariant(input: OwnershipLabelSource): CompactEntityLabelVariant {
  if (input.isDaydreamsAgent) {
    return "agent";
  }

  if (input.isMine) {
    return "mine";
  }

  return input.isAlly ? "ally" : "enemy";
}

function resolveStructureTypeLabel(structureType: StructureType): string {
  const modeLabel = getGameModeConfig().structure.getTypeName(structureType);
  if (modeLabel) {
    return modeLabel;
  }

  switch (structureType) {
    case StructureType.Realm:
      return "Realm";
    case StructureType.Camp:
      return "Camp";
    case StructureType.Village:
      return "Village";
    case StructureType.Hyperstructure:
      return "Hyperstructure";
    case StructureType.Bank:
      return "Bank";
    case StructureType.FragmentMine:
      return "Fragment Mine";
    case StructureType.BitcoinMine:
      return "Mine";
    case StructureType.HolySite:
      return "Holy Site";
    default:
      return "Structure";
  }
}
