import { StructureType } from "@bibliothecadao/types";
import { Euler, Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { applyVisibleStructurePresentation, PLATE_CLEARANCE } from "./structure-visible-presentation";

const TILE_HEIGHT = 0.3;

/** Presents one structure whose model stands so high, and returns where its plate was put. */
const plateOver = (modelHeight: number, structureType = StructureType.Camp): Vector3 => {
  let plate: Vector3 | undefined;
  applyVisibleStructurePresentation({
    structure: { entityId: 7, hexCoords: { col: 3, row: 4 }, structureType },
    rotationY: 0,
    dummy: new Object3D(),
    scratchPosition: new Vector3(),
    scratchCompactLabelPosition: new Vector3(),
    tempCosmeticPosition: new Vector3(),
    tempCosmeticRotation: new Euler(),
    getWorldPositionForHexCoordsInto: (col, row, target) => target.set(col, TILE_HEIGHT, row),
    resolveModelHeight: () => modelHeight,
    syncCompactLabel: (_structure, position) => (plate = position.clone()),
    resolveAttachments: () => [],
    getAttachmentSignature: () => "",
    activeAttachmentEntities: new Set(),
    attachmentSignatures: new Map(),
    spawnAttachments: () => {},
    removeAttachments: () => {},
    resolveMountTransforms: () => undefined,
    updateAttachmentTransforms: () => {},
  });
  return plate!;
};

describe("a structure's plate", () => {
  it("sits just over the top of the model it labels, a low camp or a tall tower alike", () => {
    const camp = plateOver(1.2);
    const tower = plateOver(3.9);
    const base = (plate: Vector3, modelHeight: number) => plate.y - modelHeight - PLATE_CLEARANCE;
    // Over its own tile, and the same small step above the roof whatever the roof's height.
    expect([camp.x, camp.z]).toEqual([3, 4]);
    expect(base(camp, 1.2)).toBeCloseTo(base(tower, 3.9));
    expect(camp.y).toBeGreaterThan(TILE_HEIGHT + 1.2);
    expect(tower.y).toBeGreaterThan(TILE_HEIGHT + 3.9);
    // A camp's plate stays under where a tower's would be: it does not float over the tile behind.
    expect(camp.y).toBeLessThan(tower.y - 2);
  });
});

it("places the picked realm floor directly on the terrain while other structures keep their existing lift", () => {
  expect(plateOver(2, StructureType.Realm).y).toBeCloseTo(TILE_HEIGHT + 2 + PLATE_CLEARANCE);
  expect(plateOver(2, StructureType.Camp).y).toBeCloseTo(TILE_HEIGHT + 0.05 + 2 + PLATE_CLEARANCE);
});
