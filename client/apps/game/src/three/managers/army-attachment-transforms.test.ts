import { Euler, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { syncArmyAttachmentTransformState } from "./army-attachment-transforms";

describe("syncArmyAttachmentTransformState", () => {
  it("uses instance transforms for tracked armies and updates attachments", () => {
    const tempPosition = new Vector3();
    const updateAttachmentTransforms = vi.fn();
    const resolveMountTransforms = vi.fn(() => "mounts");

    syncArmyAttachmentTransformState({
      entityId: 7,
      army: {
        category: 1 as never,
        tier: 2 as never,
        hexCoords: { getContract: () => ({ x: 3, y: 4 }) },
      } as never,
      instanceData: {
        position: new Vector3(10, 11, 12),
        rotation: new Euler(0.1, 0.2, 0.3),
        scale: new Vector3(2, 2, 2),
      },
      activeArmyAttachmentEntities: new Set([7]),
      tempPosition,
      scale: new Vector3(1, 1, 1),
      attachmentTransformScratch: new Map(),
      getWorldPositionInto: vi.fn(),
      resolveBiome: vi.fn(() => "plains"),
      getModelTypeForEntity: vi.fn(() => "knight"),
      resolveMountTransforms,
      updateAttachmentTransforms,
    });

    expect(tempPosition.toArray()).toEqual([10, 11, 12]);
    expect(resolveMountTransforms).toHaveBeenCalledWith(
      "knight",
      expect.objectContaining({
        position: tempPosition,
        rotation: expect.any(Euler),
        scale: expect.any(Vector3),
      }),
      expect.any(Map),
    );
    expect(updateAttachmentTransforms).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        position: tempPosition,
      }),
      "mounts",
    );
  });

  it("falls back to world position and default scale when instance transforms are missing", () => {
    const tempPosition = new Vector3();
    const getWorldPositionInto = vi.fn((out: Vector3) => out.set(5, 6, 7));
    const updateAttachmentTransforms = vi.fn();

    syncArmyAttachmentTransformState({
      entityId: 9,
      army: {
        category: 1 as never,
        tier: 3 as never,
        hexCoords: { getContract: () => ({ x: 8, y: 9 }) },
      } as never,
      instanceData: undefined,
      activeArmyAttachmentEntities: new Set([9]),
      tempPosition,
      scale: new Vector3(3, 3, 3),
      attachmentTransformScratch: new Map(),
      getWorldPositionInto,
      resolveBiome: vi.fn(() => "coast"),
      getModelTypeForEntity: vi.fn(() => "boat"),
      resolveMountTransforms: vi.fn(() => "mounts"),
      updateAttachmentTransforms,
    });

    expect(getWorldPositionInto).toHaveBeenCalled();
    expect(updateAttachmentTransforms).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        position: tempPosition,
        scale: expect.objectContaining({ x: 3, y: 3, z: 3 }),
      }),
      "mounts",
    );
  });

  it("skips transform work for armies without tracked attachments", () => {
    const updateAttachmentTransforms = vi.fn();

    syncArmyAttachmentTransformState({
      entityId: 12,
      army: {
        category: 1 as never,
        tier: 1 as never,
        hexCoords: { getContract: () => ({ x: 1, y: 2 }) },
      } as never,
      instanceData: undefined,
      activeArmyAttachmentEntities: new Set(),
      tempPosition: new Vector3(),
      scale: new Vector3(1, 1, 1),
      attachmentTransformScratch: new Map(),
      getWorldPositionInto: vi.fn(),
      resolveBiome: vi.fn(),
      getModelTypeForEntity: vi.fn(),
      resolveMountTransforms: vi.fn(),
      updateAttachmentTransforms,
    });

    expect(updateAttachmentTransforms).not.toHaveBeenCalled();
  });
});
