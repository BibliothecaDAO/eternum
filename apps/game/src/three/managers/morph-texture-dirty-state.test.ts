import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { writeMorphWeightsIfChanged } from "./morph-texture-dirty-state";

describe("writeMorphWeightsIfChanged", () => {
  it("does not dirty an unchanged morph row", () => {
    const target = new Float32Array([1, 0.25, 0.75, 1, 0, 0]);
    const source = new Float32Array([0.25, 0.75]);

    expect(writeMorphWeightsIfChanged(target, 0, 3, source, 0, 2)).toBe(false);
    expect(Array.from(target)).toEqual([1, 0.25, 0.75, 1, 0, 0]);
  });

  it("copies and dirties a changed morph row", () => {
    const target = new Float32Array([1, 0.25, 0.75, 1, 0, 0]);
    const source = new Float32Array([9, 0.5, 0.5, 9]);

    expect(writeMorphWeightsIfChanged(target, 1, 3, source, 1, 2)).toBe(true);
    expect(Array.from(target)).toEqual([1, 0.25, 0.75, 1, 0.5, 0.5]);
  });

  it("writes an instance's weights where three's own setMorphAt keeps them", () => {
    const geometry = twoTargetGeometry();
    const byThree = new InstancedMesh(geometry, undefined, 2);
    const byRow = new InstancedMesh(geometry, undefined, 2);
    for (const mesh of [byThree, byRow]) {
      mesh.setMorphAt(0, posed(geometry, [0, 0]));
      mesh.setMorphAt(1, posed(geometry, [0, 0]));
    }
    byThree.setMorphAt(1, posed(geometry, [0.25, 0.75]));

    const rows = byRow.morphTexture!.image.data as Float32Array;
    writeMorphWeightsIfChanged(rows, 1, byRow.morphTexture!.image.width, new Float32Array([0.25, 0.75]), 0, 2);

    expect(Array.from(rows)).toEqual(Array.from(byThree.morphTexture!.image.data as Float32Array));
  });
});

function twoTargetGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
  geometry.morphAttributes.position = [
    new Float32BufferAttribute([1, 0, 0], 3),
    new Float32BufferAttribute([0, 1, 0], 3),
  ];
  geometry.morphTargetsRelative = true;
  return geometry;
}

function posed(geometry: BufferGeometry, influences: number[]): Mesh {
  const mesh = new Mesh(geometry);
  mesh.morphTargetInfluences = influences;
  return mesh;
}
