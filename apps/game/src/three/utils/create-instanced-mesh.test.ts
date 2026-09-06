import { BoxGeometry, Camera, Group, Matrix4, MeshBasicMaterial, Scene } from "three";
import { describe, expect, it } from "vitest";
import { createInstancedMesh } from "./create-instanced-mesh";

function prepare(mesh: ReturnType<typeof createInstancedMesh>, nativeWebGPU: boolean) {
  const renderer = { backend: { isWebGPUBackend: nativeWebGPU } } as unknown as Parameters<
    typeof mesh.onBeforeRender
  >[0];
  mesh.onBeforeRender(
    renderer,
    new Scene(),
    new Camera(),
    mesh.geometry,
    mesh.material as MeshBasicMaterial,
    new Group(),
  );
}

it("retains writes made before compilation and keeps the native GPU buffer stable afterwards", () => {
  const mesh = createInstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 8);
  const source = mesh.instanceMatrix.array;
  mesh.setMatrixAt(3, new Matrix4().makeTranslation(4, 5, 6));
  prepare(mesh, true);
  const matrices = mesh.instanceMatrix;
  expect(matrices.array).toBe(source);
  expect(matrices).toHaveProperty("isStorageInstancedBufferAttribute", true);
  expect(new Matrix4().fromArray(matrices.array, 3 * 16).elements.slice(12, 15)).toEqual([4, 5, 6]);

  mesh.setMatrixAt(3, new Matrix4().makeTranslation(7, 8, 9));
  matrices.addUpdateRange(3 * 16, 16);
  matrices.needsUpdate = true;
  prepare(mesh, true);
  expect(mesh.instanceMatrix).toBe(matrices);
  expect(matrices.updateRanges).toEqual([{ start: 48, count: 16 }]);
  expect(new Matrix4().fromArray(matrices.array, 3 * 16).elements.slice(12, 15)).toEqual([7, 8, 9]);
  mesh.geometry.dispose();
  mesh.material.dispose();
  mesh.dispose();
});

describe.each([0, 2, 1500])("instance capacity %i", (capacity) => {
  it("preserves WebGL attributes and logical capacity", () => {
    const mesh = createInstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), capacity);
    const matrices = mesh.instanceMatrix;
    prepare(mesh, false);
    expect(mesh.instanceMatrix).toBe(matrices);
    expect(mesh.count).toBe(capacity);
    expect(matrices.count).toBe(capacity);
    expect(matrices).not.toHaveProperty("isStorageInstancedBufferAttribute");
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.dispose();
  });
});

describe.each([true, false])("sparse instances with native WebGPU %s", (nativeWebGPU) => {
  it("hides unassigned slots below the highest visible instance", () => {
    const mesh = createInstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 8);
    const placed = new Matrix4().makeScale(2, 3, 4).setPosition(10, 5, -7);
    const hidden = new Matrix4().makeScale(0, 0, 0);
    mesh.setMatrixAt(6, placed);
    mesh.count = 7;
    prepare(mesh, nativeWebGPU);

    for (let slot = 0; slot < mesh.count; slot++) {
      const actual = new Matrix4();
      mesh.getMatrixAt(slot, actual);
      expect(actual.elements).toEqual(slot === 6 ? placed.elements : hidden.elements);
    }
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.dispose();
  });

  it("keeps copied active transforms and hides new slots after capacity grows", () => {
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const original = createInstancedMesh(geometry, material, 4);
    const placed = new Matrix4().makeTranslation(8, 2, -3);
    original.setMatrixAt(2, placed);
    prepare(original, nativeWebGPU);

    const expanded = createInstancedMesh(geometry, material, 12);
    expanded.instanceMatrix.array.set(original.instanceMatrix.array);
    expanded.setMatrixAt(10, placed);
    expanded.count = 11;
    prepare(expanded, nativeWebGPU);

    const hidden = new Matrix4().makeScale(0, 0, 0);
    for (let slot = 0; slot < expanded.instanceMatrix.count; slot++) {
      const actual = new Matrix4();
      expanded.getMatrixAt(slot, actual);
      expect(actual.elements).toEqual(slot === 2 || slot === 10 ? placed.elements : hidden.elements);
    }
    original.dispose();
    expanded.dispose();
    geometry.dispose();
    material.dispose();
  });
});
