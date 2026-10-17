import { StructureType } from "@bibliothecadao/types";
import { Euler, Object3D, Vector3 } from "three";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** Structures sit just above the terrain sample; the plate floats above the roofline. */
export const STRUCTURE_SURFACE_LIFT = 0.05;
/**
 * How far over its model's top a structure's plate sits: just over the roof of whatever is drawn, a camp or a tower,
 * so it neither cuts into a tall model nor floats over the tile behind a low one, where a unit may stand.
 */
export const PLATE_CLEARANCE = 0.45;

/** Realms and the Bitcoin mine are modelled with its base at the terrain top: terrain owns its support, so it takes no lift. */
export function sitsDirectlyOnTerrain(structureType: unknown): boolean {
  return structureType === StructureType.BitcoinMine || structureType === StructureType.Realm;
}

interface ApplyVisibleStructurePresentationInput<
  TStructure extends {
    entityId: TEntityId;
    hexCoords: { col: number; row: number };
    structureType: unknown;
  },
  TEntityId extends string | number | bigint,
  TAttachmentTemplate,
  TMountTransforms,
> {
  structure: TStructure;
  rotationY: number;
  dummy: Object3D;
  scratchPosition: Vector3;
  scratchCompactLabelPosition: Vector3;
  tempCosmeticPosition: Vector3;
  tempCosmeticRotation: Euler;
  getWorldPositionForHexCoordsInto: (col: number, row: number, target: Vector3) => void;
  /** How high the structure's model stands over its tile; its plate sits just over that. */
  resolveModelHeight: (structure: TStructure) => number;
  syncCompactLabel?: (structure: TStructure, position: Vector3) => void;
  resolveAttachments: (structure: TStructure) => TAttachmentTemplate[];
  getAttachmentSignature: (templates: TAttachmentTemplate[]) => string;
  activeAttachmentEntities: Set<number>;
  attachmentSignatures: Map<number, string>;
  spawnAttachments: (entityId: number, templates: TAttachmentTemplate[]) => void;
  removeAttachments: (entityId: number) => void;
  resolveMountTransforms: (
    structure: TStructure,
    baseTransform: { position: Vector3; rotation: Euler; scale: Vector3 },
  ) => TMountTransforms;
  updateAttachmentTransforms: (
    entityId: number,
    baseTransform: { position: Vector3; rotation: Euler; scale: Vector3 },
    mountTransforms: TMountTransforms,
  ) => void;
  attachmentRetain?: Set<number>;
}

export function applyVisibleStructurePresentation<
  TStructure extends {
    entityId: TEntityId;
    hexCoords: { col: number; row: number };
    structureType: unknown;
  },
  TEntityId extends string | number | bigint,
  TAttachmentTemplate,
  TMountTransforms,
>(input: ApplyVisibleStructurePresentationInput<TStructure, TEntityId, TAttachmentTemplate, TMountTransforms>): void {
  const { col, row } = input.structure.hexCoords;
  input.getWorldPositionForHexCoordsInto(col, row, input.scratchPosition);
  input.scratchPosition.y += sitsDirectlyOnTerrain(input.structure.structureType) ? 0 : STRUCTURE_SURFACE_LIFT;
  input.dummy.position.copy(input.scratchPosition);
  input.dummy.rotation.y = input.rotationY;
  input.dummy.updateMatrix();

  input.scratchCompactLabelPosition.copy(input.scratchPosition);
  input.scratchCompactLabelPosition.y += input.resolveModelHeight(input.structure) + PLATE_CLEARANCE;
  input.syncCompactLabel?.(input.structure, input.scratchCompactLabelPosition);

  const entityNumericId = safeInteger(input.structure.entityId);
  const templates = input.resolveAttachments(input.structure);
  if (templates.length > 0) {
    input.attachmentRetain?.add(entityNumericId);
    const signature = input.getAttachmentSignature(templates);
    const isActive = input.activeAttachmentEntities.has(entityNumericId);
    if (!isActive || input.attachmentSignatures.get(entityNumericId) !== signature) {
      input.spawnAttachments(entityNumericId, templates);
      input.attachmentSignatures.set(entityNumericId, signature);
      input.activeAttachmentEntities.add(entityNumericId);
    }

    input.tempCosmeticPosition.copy(input.scratchPosition);
    input.tempCosmeticRotation.copy(input.dummy.rotation);

    const baseTransform = {
      position: input.tempCosmeticPosition,
      rotation: input.tempCosmeticRotation,
      scale: input.dummy.scale,
    };
    const mountTransforms = input.resolveMountTransforms(input.structure, baseTransform);
    input.updateAttachmentTransforms(entityNumericId, baseTransform, mountTransforms);
    return;
  }

  if (input.activeAttachmentEntities.has(entityNumericId)) {
    input.removeAttachments(entityNumericId);
    input.activeAttachmentEntities.delete(entityNumericId);
    input.attachmentSignatures.delete(entityNumericId);
  }
}
