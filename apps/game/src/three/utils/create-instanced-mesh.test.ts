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
