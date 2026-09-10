import { TroopTier } from "@bibliothecadao/types";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { MeleeImpactSystem } from "./melee-impact-system";

describe("melee impact system", () => {
  it("pools impact presentations and releases them after their visual lifetime", () => {
    const system = new MeleeImpactSystem(2);
    const input = {
      direction: new Vector3(1, 0, 0),
      target: new Vector3(2, 0, 3),
      tier: TroopTier.T2,
    };

    expect(system.spawn(input)).toBe(true);
    expect(system.spawn(input)).toBe(true);
    expect(system.spawn(input)).toBe(false);
    expect(system.getStats()).toMatchObject({ activeCount: 2, droppedCount: 1, spawnedCount: 2 });

    for (let index = 0; index < 5; index += 1) system.update(0.1);
    expect(system.getStats().activeCount).toBe(0);
    system.dispose();
  });
});

it("does no drawing or buffer writes while idle, and packs surviving impacts into the drawn prefix", () => {
  const system = new MeleeImpactSystem(4);
  const meshes = system.group.children as InstancedMesh[];
  const versions = meshes.map((mesh) => mesh.instanceMatrix.version);
  for (let frame = 0; frame < 60; frame++) system.update(1 / 60);
  expect(meshes.map((mesh) => mesh.count)).toEqual([0, 0]);
  expect(meshes.map((mesh) => mesh.instanceMatrix.version)).toEqual(versions);
  expect(meshes.every((mesh) => !mesh.visible)).toBe(true);

  const spawn = (x: number) =>
    system.spawn({ direction: new Vector3(0, 0, 1), target: new Vector3(x, 0, 0), tier: TroopTier.T1 });
  spawn(1);
  for (let frame = 0; frame < 3; frame++) system.update(0.1);
  spawn(2);
  system.update(0.1);
  expect(meshes.map((mesh) => mesh.count)).toEqual([2, 2]);
  for (const mesh of meshes) mesh.instanceMatrix.clearUpdateRanges();
  system.update(0.1);
  expect(system.getStats().activeCount).toBe(1);
  for (const mesh of meshes) {
    expect(mesh.count).toBe(1);
    const transform = new Matrix4();
    mesh.getMatrixAt(0, transform);
    expect(transform.elements[12]).toBe(2);
    expect(mesh.instanceMatrix.updateRanges).toEqual([{ start: 0, count: 16 }]);
  }
  system.reset();
  expect(meshes.every((mesh) => !mesh.visible)).toBe(true);
  expect(meshes.map((mesh) => mesh.count)).toEqual([0, 0]);
  spawn(3);
  system.update(0);
  expect(meshes.every((mesh) => mesh.visible)).toBe(true);
  expect(meshes.map((mesh) => mesh.count)).toEqual([1, 1]);
  system.dispose();
});

it("keeps simulating while overview hides the group and never overrides that visibility", () => {
  const system = new MeleeImpactSystem();
  system.group.visible = false;
  system.spawn({ direction: new Vector3(0, 0, 1), target: new Vector3(), tier: TroopTier.T1 });
  system.update(0.1);
  expect(system.group.visible).toBe(false);
  expect(system.getStats().activeCount).toBe(1);
  for (let frame = 0; frame < 4; frame++) system.update(0.1);
  expect(system.getStats().activeCount).toBe(0);
  system.group.visible = true;
  expect((system.group.children as InstancedMesh[]).every((mesh) => mesh.count === 0 && !mesh.visible)).toBe(true);
  system.dispose();
});
