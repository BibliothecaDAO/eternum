import { Euler, Object3D, Vector3 } from "three";

interface VisibleStructureLabel {
  position: Vector3;
}

interface VisibleStructurePointRenderer<TEntityId> {
  hasPoint(entityId: TEntityId): boolean;
  removePoint(entityId: TEntityId): void;
  setPoint(input: { entityId: TEntityId; position: Vector3 }): void;
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
  TLabel extends VisibleStructureLabel = VisibleStructureLabel,
  TRenderer extends VisibleStructurePointRenderer<TEntityId> = VisibleStructurePointRenderer<TEntityId>,
> {
  previousStructure?: TStructure;
  structure: TStructure;
  rotationY: number;
  dummy: Object3D;
  scratchPosition: Vector3;
  scratchLabelPosition: Vector3;
  scratchIconPosition: Vector3;
  tempCosmeticPosition: Vector3;
  tempCosmeticRotation: Euler;
  getWorldPositionForHexCoordsInto: (col: number, row: number, target: Vector3) => void;
  getLabel: (entityId: TEntityId) => TLabel | undefined;
  updateLabel: (structure: TStructure, label: TLabel) => void;
  getRendererForStructure: (structure: TStructure) => TRenderer | null;
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
  TLabel extends VisibleStructureLabel = VisibleStructureLabel,
  TRenderer extends VisibleStructurePointRenderer<TEntityId> = VisibleStructurePointRenderer<TEntityId>,
>(
  input: ApplyVisibleStructurePresentationInput<
    TStructure,
    TEntityId,
    TAttachmentTemplate,
    TMountTransforms,
    TLabel,
    TRenderer
  >,
): void {
  const { col, row } = input.structure.hexCoords;
  input.getWorldPositionForHexCoordsInto(col, row, input.scratchPosition);
  input.scratchPosition.y += 0.05;
  input.dummy.position.copy(input.scratchPosition);
  input.dummy.rotation.y = input.rotationY;
  input.dummy.updateMatrix();

  const label = input.getLabel(input.structure.entityId);
  if (label) {
    input.updateLabel(input.structure, label);
    input.getWorldPositionForHexCoordsInto(col, row, input.scratchLabelPosition);
    input.scratchLabelPosition.y += 2;
    label.position.copy(input.scratchLabelPosition);
  }

  const previousRenderer = input.previousStructure ? input.getRendererForStructure(input.previousStructure) : null;
  const nextRenderer = input.getRendererForStructure(input.structure);
  if (previousRenderer && previousRenderer !== nextRenderer && previousRenderer.hasPoint(input.structure.entityId)) {
    previousRenderer.removePoint(input.structure.entityId);
  }
  if (nextRenderer) {
    input.scratchIconPosition.copy(input.scratchPosition);
    input.scratchIconPosition.y += 2;
    nextRenderer.setPoint({
      entityId: input.structure.entityId,
      position: input.scratchIconPosition,
    });
  }

  const entityNumericId = Number(input.structure.entityId);
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
