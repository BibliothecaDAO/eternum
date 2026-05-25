import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";

const { resolveArmyCosmetic } = vi.hoisted(() => ({
  resolveArmyCosmetic: vi.fn(() => ({
    skin: {
      cosmeticId: "army:Knight:T1:custom",
      assetPaths: ["custom.glb"],
      isFallback: false,
    },
    attachments: [{ id: "banner", slot: "banner" }],
  })),
}));
const { findCosmeticById } = vi.hoisted(() => ({
  findCosmeticById: vi.fn((cosmeticId: string) => ({ id: cosmeticId })),
}));

vi.mock("../cosmetics", () => ({
  resolveArmyCosmetic,
  findCosmeticById,
}));

import { resolveArmyCosmeticPresentation, resolveArmyPresentationPosition } from "./army-instance-presentation";

describe("army instance presentation", () => {
  it("uses the live moving position when an army is already interpolating", () => {
    const movingPosition = new Vector3(3, 4, 5);

    const result = resolveArmyPresentationPosition({
      entityId: 7 as any,
      hexCoords: { kind: "hex" } as any,
      path: [{ kind: "path-start" } as any],
      isMoving: true,
      movingPosition,
      getArmyWorldPosition: vi.fn(() => new Vector3(1, 2, 3)),
    });

    expect(result).not.toBe(movingPosition);
    expect(result).toEqual(movingPosition);
  });

  it("falls back to the first path hex before the current hex when resolving world position", () => {
    const getArmyWorldPosition = vi.fn(() => new Vector3(1, 2, 3));
    const pathStart = { kind: "path-start" } as any;

    resolveArmyPresentationPosition({
      entityId: 7 as any,
      hexCoords: { kind: "hex" } as any,
      path: [pathStart],
      isMoving: false,
      movingPosition: undefined,
      getArmyWorldPosition,
    });

    expect(getArmyWorldPosition).toHaveBeenCalledWith(7, pathStart);
  });

  it("re-resolves army cosmetics and produces a cosmetic assignment when a custom skin exists", () => {
    const result = resolveArmyCosmeticPresentation({
      army: {
        owner: { address: 123n },
        category: "Knight",
        tier: "T1",
        cosmeticId: "old",
        cosmeticAssetPaths: ["old.glb"],
        usesFallbackCosmeticSkin: true,
        attachments: [],
      } as any,
      modelType: "knight" as any,
      reResolveCosmetics: true,
    });

    expect(resolveArmyCosmetic).toHaveBeenCalled();
    expect(result.cosmeticId).toBe("army:Knight:T1:custom");
    expect(result.clearCosmeticAssignment).toBe(false);
    expect(result.cosmeticAssignment).toEqual({
      cosmeticId: "army:Knight:T1:custom",
      assetPaths: ["custom.glb"],
      isFallback: false,
      registryEntry: { id: "army:Knight:T1:custom" },
    });
  });

  it("clears cosmetic assignment when only fallback data is available", () => {
    const result = resolveArmyCosmeticPresentation({
      army: {
        owner: { address: 123n },
        category: "Knight",
        tier: "T1",
        cosmeticId: "old",
        cosmeticAssetPaths: [],
        usesFallbackCosmeticSkin: true,
        attachments: [],
      } as any,
      modelType: "knight" as any,
      reResolveCosmetics: false,
    });

    expect(result.clearCosmeticAssignment).toBe(true);
    expect(result.cosmeticAssignment).toBeUndefined();
  });
});
