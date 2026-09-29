import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import type NodeBuilder from "three/src/nodes/core/NodeBuilder.js";
import { expect, it } from "vitest";
import { GameMapMaterialLibrary } from "./game-map-material-library";

it.each(["terrain", "army"])("refreshes frost on every stationary %s mesh sharing a material", (kind) => {
  const material = kind === "terrain" ? new MeshStandardMaterial() : new MeshBasicMaterial();
  const object = new Mesh(undefined, material);
  object.userData.gameEndFrost = kind === "army";
  const nodeMaterial = Object.assign(new (new GameMapMaterialLibrary().materialNodes.get(material.type)!)(), material);
  const observer = nodeMaterial.setupObserver({
    material,
    object,
    context: {},
  } as unknown as NodeBuilder) as unknown as {
    needsRefresh(object: { object: Mesh }, frame: { renderId: number }): boolean;
  };
  // After the first draw, unchanged siblings must still upload the shared frost uniform.
  expect(observer.needsRefresh({ object }, { renderId: 10 })).toBe(true);
  expect(observer.needsRefresh({ object }, { renderId: 10 })).toBe(true);
});

it("keeps ordinary translucent overlays outside the frost update path", () => {
  const material = new MeshStandardMaterial({ transparent: true });
  const object = new Mesh(undefined, material);
  const nodeMaterial = Object.assign(new (new GameMapMaterialLibrary().materialNodes.get(material.type)!)(), material);
  const observer = nodeMaterial.setupObserver({ material, object, context: {} } as unknown as NodeBuilder);
  expect(observer.hasNode).toBe(false);
});
