import type { Position } from "@bibliothecadao/eternum";
import type { Vector3 } from "three";

import { findCosmeticById, resolveArmyCosmetic } from "../cosmetics";
import type { ArmyData } from "../types";
import type { ModelType } from "../types/army";

export function resolveArmyPresentationPosition(input: {
  entityId: ArmyData["entityId"];
  hexCoords: Position;
  path?: Position[];
  isMoving: boolean;
  movingPosition?: Vector3 | null;
  getArmyWorldPosition: (entityId: ArmyData["entityId"], hexCoords: Position) => Vector3;
}): Vector3 {
  const sourceHex = input.path && input.path.length > 0 ? input.path[0] : input.hexCoords;

  if (input.isMoving) {
    return input.movingPosition?.clone() ?? input.getArmyWorldPosition(input.entityId, sourceHex);
  }

  return input.getArmyWorldPosition(input.entityId, sourceHex);
}

export function resolveArmyCosmeticPresentation(input: {
  army: Pick<
    ArmyData,
    "owner" | "category" | "tier" | "cosmeticId" | "cosmeticAssetPaths" | "usesFallbackCosmeticSkin" | "attachments"
  >;
  modelType: ModelType;
  reResolveCosmetics?: boolean;
}): {
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
  usesFallbackCosmeticSkin: boolean;
  attachments: ArmyData["attachments"];
  cosmeticAssignment?:
    | {
        cosmeticId: string;
        assetPaths: string[];
        isFallback: false;
        registryEntry: ReturnType<typeof findCosmeticById>;
      }
    | undefined;
  clearCosmeticAssignment: boolean;
} {
  let cosmeticId = input.army.cosmeticId;
  let cosmeticAssetPaths = input.army.cosmeticAssetPaths;
  let usesFallbackCosmeticSkin = input.army.usesFallbackCosmeticSkin ?? true;
  let attachments = input.army.attachments;

  if (input.reResolveCosmetics) {
    const cosmetic = resolveArmyCosmetic({
      owner: input.army.owner.address,
      troopType: input.army.category,
      tier: input.army.tier,
      defaultModelType: input.modelType,
    });
    cosmeticId = cosmetic.skin.cosmeticId;
    cosmeticAssetPaths = cosmetic.skin.assetPaths;
    usesFallbackCosmeticSkin = cosmetic.skin.isFallback;
    attachments = cosmetic.attachments;
  }

  const hasCosmeticSkin = Boolean(
    cosmeticId && cosmeticAssetPaths && cosmeticAssetPaths.length > 0 && !usesFallbackCosmeticSkin,
  );

  return {
    cosmeticId,
    cosmeticAssetPaths,
    usesFallbackCosmeticSkin,
    attachments,
    cosmeticAssignment: hasCosmeticSkin
      ? {
          cosmeticId: cosmeticId!,
          assetPaths: cosmeticAssetPaths!,
          isFallback: false,
          registryEntry: findCosmeticById(cosmeticId!),
        }
      : undefined,
    clearCosmeticAssignment: !hasCosmeticSkin,
  };
}
