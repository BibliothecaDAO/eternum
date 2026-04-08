import type { ArmyData } from "../types";

export function createArmyRecord(input: ArmyData): ArmyData {
  return {
    entityId: input.entityId,
    hexCoords: input.hexCoords,
    matrixIndex: input.matrixIndex,
    isMine: input.isMine,
    owningStructureId: input.owningStructureId,
    owner: input.owner,
    color: input.color,
    category: input.category,
    tier: input.tier,
    isDaydreamsAgent: input.isDaydreamsAgent,
    cosmeticId: input.cosmeticId,
    cosmeticAssetPaths: input.cosmeticAssetPaths,
    usesFallbackCosmeticSkin: input.usesFallbackCosmeticSkin,
    attachments: input.attachments,
    troopCount: input.troopCount,
    currentStamina: input.currentStamina,
    maxStamina: input.maxStamina,
    onChainStamina: input.onChainStamina,
    attackedFromDegrees: input.attackedFromDegrees,
    attackedTowardDegrees: input.attackedTowardDegrees,
    battleCooldownEnd: input.battleCooldownEnd,
    battleTimerLeft: input.battleTimerLeft,
  };
}
