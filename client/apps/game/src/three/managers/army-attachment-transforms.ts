import type { AttachmentTransform } from "../cosmetics";
import type { ArmyData } from "../types";
import type { ArmyInstanceData } from "../types/army";
import type { Vector3 } from "three";

interface SyncArmyAttachmentTransformStateInput<TBiome, TModelType, TMountTransforms> {
  entityId: number;
  army: Pick<ArmyData, "category" | "hexCoords" | "tier">;
  instanceData?: Pick<ArmyInstanceData, "position" | "rotation" | "scale">;
  activeArmyAttachmentEntities: Set<number>;
  tempPosition: Vector3;
  scale: Vector3;
  attachmentTransformScratch: Map<string, AttachmentTransform>;
  getWorldPositionInto: (out: Vector3, hexCoords: ArmyData["hexCoords"]) => Vector3;
  resolveBiome: (x: number, y: number) => TBiome;
  getModelTypeForEntity: (
    entityId: number,
    category: ArmyData["category"],
    tier: ArmyData["tier"],
    biome: TBiome,
  ) => TModelType;
  resolveMountTransforms: (
    modelType: TModelType,
    baseTransform: {
      position: Vector3;
      rotation?: ArmyInstanceData["rotation"];
      scale: Vector3;
    },
    scratch: Map<string, AttachmentTransform>,
  ) => TMountTransforms;
  updateAttachmentTransforms: (
    entityId: number,
    baseTransform: {
      position: Vector3;
      rotation?: ArmyInstanceData["rotation"];
      scale: Vector3;
    },
    mountTransforms: TMountTransforms,
  ) => void;
}

export function syncArmyAttachmentTransformState<TBiome, TModelType, TMountTransforms>(
  input: SyncArmyAttachmentTransformStateInput<TBiome, TModelType, TMountTransforms>,
): void {
  if (!input.activeArmyAttachmentEntities.has(input.entityId)) {
    return;
  }

  const baseTransform = resolveArmyAttachmentBaseTransform(input);
  const modelType = resolveArmyAttachmentModelType(input);
  const mountTransforms = input.resolveMountTransforms(modelType, baseTransform, input.attachmentTransformScratch);

  input.updateAttachmentTransforms(input.entityId, baseTransform, mountTransforms);
}

function resolveArmyAttachmentBaseTransform<TBiome, TModelType, TMountTransforms>(
  input: SyncArmyAttachmentTransformStateInput<TBiome, TModelType, TMountTransforms>,
): {
  position: Vector3;
  rotation?: ArmyInstanceData["rotation"];
  scale: Vector3;
} {
  if (input.instanceData?.position) {
    input.tempPosition.copy(input.instanceData.position);
  } else {
    input.getWorldPositionInto(input.tempPosition, input.army.hexCoords);
  }

  return {
    position: input.tempPosition,
    rotation: input.instanceData?.rotation,
    scale: input.instanceData?.scale ?? input.scale,
  };
}

function resolveArmyAttachmentModelType<TBiome, TModelType, TMountTransforms>(
  input: SyncArmyAttachmentTransformStateInput<TBiome, TModelType, TMountTransforms>,
): TModelType {
  const { x, y } = input.army.hexCoords.getContract();
  const biome = input.resolveBiome(x, y);

  return input.getModelTypeForEntity(input.entityId, input.army.category, input.army.tier, biome);
}
