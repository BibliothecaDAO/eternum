import { describe, expect, it, vi } from "vitest";
import { Euler, Object3D, Vector3 } from "three";

import { applyVisibleStructurePresentation } from "./structure-visible-presentation";

type StructureStub = {
  entityId: number;
  structureType: string;
  hexCoords: { col: number; row: number };
};

type LabelStub = {
  position: Vector3;
};

type RendererStub = {
  hasPoint: ReturnType<typeof vi.fn>;
  removePoint: ReturnType<typeof vi.fn>;
  setPoint: ReturnType<typeof vi.fn>;
};

describe("applyVisibleStructurePresentation", () => {
  it("updates label, point, rotation, and attachments for the rendered structure", () => {
    const previousRenderer: RendererStub = {
      hasPoint: vi.fn(() => true),
      removePoint: vi.fn(),
      setPoint: vi.fn(),
    };
    const nextRenderer: RendererStub = {
      hasPoint: vi.fn(() => false),
      removePoint: vi.fn(),
      setPoint: vi.fn(),
    };
    const label: LabelStub = { position: new Vector3() };
    const dummy = new Object3D();
    const activeAttachmentEntities = new Set<number>();
    const attachmentSignatures = new Map<number, string>();
    const attachmentRetain = new Set<number>();
    const updateLabel = vi.fn();
    const spawnAttachments = vi.fn();
    const removeAttachments = vi.fn();
    const updateAttachmentTransforms = vi.fn();
    const resolveMountTransforms = vi.fn(() => ({ mounted: true }));

    applyVisibleStructurePresentation({
      previousStructure: { entityId: 7, structureType: "Village", hexCoords: { col: 1, row: 2 } },
      structure: { entityId: 7, structureType: "Bank", hexCoords: { col: 4, row: 5 } },
      rotationY: 1.25,
      dummy,
      scratchPosition: new Vector3(),
      scratchLabelPosition: new Vector3(),
      scratchIconPosition: new Vector3(),
      tempCosmeticPosition: new Vector3(),
      tempCosmeticRotation: new Euler(),
      getWorldPositionForHexCoordsInto: (col, row, target) => {
        target.set(col * 10, row * 10, 0);
      },
      getLabel: () => label,
      updateLabel,
      getRendererForStructure: (structure) => (structure.structureType === "Village" ? previousRenderer : nextRenderer),
      resolveAttachments: () => [{ id: "banner" }],
      getAttachmentSignature: () => "banner",
      activeAttachmentEntities,
      attachmentSignatures,
      spawnAttachments,
      removeAttachments,
      resolveMountTransforms,
      updateAttachmentTransforms,
      attachmentRetain,
    });

    expect(dummy.position.toArray()).toEqual([40, 50.05, 0]);
    expect(dummy.rotation.y).toBe(1.25);
    expect(updateLabel).toHaveBeenCalledWith(
      { entityId: 7, structureType: "Bank", hexCoords: { col: 4, row: 5 } },
      label,
    );
    expect(label.position.toArray()).toEqual([40, 52, 0]);
    expect(previousRenderer.removePoint).toHaveBeenCalledWith(7);
    expect(nextRenderer.setPoint).toHaveBeenCalledWith({
      entityId: 7,
      position: expect.any(Vector3),
    });
    expect(attachmentRetain.has(7)).toBe(true);
    expect(spawnAttachments).toHaveBeenCalledWith(7, [{ id: "banner" }]);
    expect(activeAttachmentEntities.has(7)).toBe(true);
    expect(attachmentSignatures.get(7)).toBe("banner");
    expect(resolveMountTransforms).toHaveBeenCalledTimes(1);
    expect(updateAttachmentTransforms).toHaveBeenCalledTimes(1);
  });

  it("removes attachments when the structure no longer resolves any templates", () => {
    const activeAttachmentEntities = new Set<number>([9]);
    const attachmentSignatures = new Map<number, string>([[9, "old"]]);
    const removeAttachments = vi.fn();

    applyVisibleStructurePresentation({
      structure: { entityId: 9, structureType: "Village", hexCoords: { col: 2, row: 3 } },
      rotationY: 0.5,
      dummy: new Object3D(),
      scratchPosition: new Vector3(),
      scratchLabelPosition: new Vector3(),
      scratchIconPosition: new Vector3(),
      tempCosmeticPosition: new Vector3(),
      tempCosmeticRotation: new Euler(),
      getWorldPositionForHexCoordsInto: (col, row, target) => {
        target.set(col, row, 0);
      },
      getLabel: () => undefined,
      updateLabel: vi.fn(),
      getRendererForStructure: () => null,
      resolveAttachments: () => [],
      getAttachmentSignature: () => "",
      activeAttachmentEntities,
      attachmentSignatures,
      spawnAttachments: vi.fn(),
      removeAttachments,
      resolveMountTransforms: vi.fn(),
      updateAttachmentTransforms: vi.fn(),
    });

    expect(removeAttachments).toHaveBeenCalledWith(9);
    expect(activeAttachmentEntities.has(9)).toBe(false);
    expect(attachmentSignatures.has(9)).toBe(false);
  });
});
