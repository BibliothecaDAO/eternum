import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShadowMaterial } from "three";
import RenderObject from "three/src/renderers/common/RenderObject.js";
import { describe, expect, it, vi } from "vitest";

import { releaseDrawnObject } from "./release-drawn-object";

const shadowMaterial = new ShadowMaterial();

/**
 * What three's WebGPU renderer keeps for each mesh it draws: a render object for its own material and one for the
 * shadow pass, each listening for the mesh's disposal. The constructor reads only cache keys from its renderer.
 */
function drawn(mesh: Mesh): RenderObject[] {
  const nodes = { getCacheKey: () => 0 };
  const pass = (material: unknown, sourceMaterial: unknown) => {
    const renderer = { contextNode: { id: 0, version: 0 }, _currentSourceMaterial: sourceMaterial };
    const renderObject = new RenderObject(
      nodes,
      {},
      renderer,
      mesh,
      material,
      new Scene(),
      new PerspectiveCamera(),
      null,
      {},
      null,
    );
    renderObject.onDispose = vi.fn();
    return renderObject;
  };
  return [pass(mesh.material, null), pass(shadowMaterial, mesh.material)];
}

describe("releaseDrawnObject", () => {
  const material = new MeshBasicMaterial();
  const page = () => {
    const group = new Group();
    const meshes = [new Mesh(new BoxGeometry(), material), new Mesh(new BoxGeometry(), material)];
    group.add(...meshes);
    return { group, renderObjects: meshes.flatMap(drawn) };
  };
  const held = (renderObject: RenderObject) =>
    material.hasEventListener("dispose", renderObject.onMaterialDispose) ||
    shadowMaterial.hasEventListener("dispose", renderObject.onMaterialDispose);

  it("frees the render objects of every mesh it releases, in both passes, while their materials live on", () => {
    const { group, renderObjects } = page();
    releaseDrawnObject(group);
    expect(renderObjects).toHaveLength(4);
    for (const renderObject of renderObjects) {
      expect(renderObject.onDispose).toHaveBeenCalledOnce();
      expect(held(renderObject)).toBe(false);
    }
  });

  it("is what frees them: disposing the geometries alone leaves every render object held by the materials", () => {
    const { group, renderObjects } = page();
    group.traverse((object) => (object instanceof Mesh ? object.geometry.dispose() : undefined));
    group.clear();
    for (const renderObject of renderObjects) {
      expect(renderObject.onDispose).not.toHaveBeenCalled();
      expect(held(renderObject)).toBe(true);
    }
  });
});
