import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { expect, it } from "vitest";
import { bakeLineupTransforms } from "./bake-lineup-transforms";

it("keeps nested static geometry at the same world position when passed to instancing", () => {
  const root = new Group();
  const parent = new Group();
  parent.position.set(2, 3, -1);
  parent.scale.set(0.07, 0.06, 0.06);
  parent.rotation.x = Math.PI / 2;
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([0, 0, 0, 2, 4, 6], 3));
  const mesh = new Mesh(geometry);
  parent.add(mesh);
  root.add(parent);
  const before = new Box3().setFromObject(root);
  bakeLineupTransforms(root);
  const after = new Box3().setFromObject(root);
  expect(after.min.distanceTo(before.min)).toBeLessThan(0.000001);
  expect(after.max.distanceTo(before.max)).toBeLessThan(0.000001);
  expect(parent.position.toArray()).toEqual([0, 0, 0]);
  expect(mesh.geometry).not.toBe(geometry);
});

it("transforms a relative morph displacement without adding the parent's translation", () => {
  const root = new Group();
  root.position.set(10, 0, 0);
  root.scale.setScalar(2);
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([1, 0, 0], 3));
  geometry.morphAttributes.position = [new Float32BufferAttribute([0, 1, 0], 3)];
  geometry.morphTargetsRelative = true;
  const mesh = new Mesh(geometry);
  root.add(mesh);
  bakeLineupTransforms(root);
  expect(new Vector3().fromBufferAttribute(mesh.geometry.getAttribute("position"), 0).toArray()).toEqual([12, 0, 0]);
  expect(new Vector3().fromBufferAttribute(mesh.geometry.morphAttributes.position![0], 0).toArray()).toEqual([0, 2, 0]);
});
