import { BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";

import { normalizeIcyDragonMaterials } from "./icy-dragon-assets";

describe("Icy dragon materials", () => {
  it("keeps the supplied PBR textures while enforcing stable opaque rendering", () => {
    const map = new Texture();
    const normalMap = new Texture();
    const body = new MeshStandardMaterial({ map, normalMap, opacity: 0.4, transparent: true });
    body.name = "defaultMat_0";
    const scene = createMaterialScene(body);

    normalizeIcyDragonMaterials(scene);

    expect(body.map).toBe(map);
    expect(body.normalMap).toBe(normalMap);
    expect(body.alphaTest).toBe(0);
    expect(body.opacity).toBe(1);
    expect(body.side).toBe(DoubleSide);
    expect(body.transparent).toBe(false);
  });

  it("rejects a non-PBR material instead of silently degrading the asset", () => {
    const scene = new Group();
    scene.add(new Mesh(new BufferGeometry()));

    expect(() => normalizeIcyDragonMaterials(scene)).toThrow("is not a standard material");
  });
});

function createMaterialScene(material: MeshStandardMaterial): Group {
  const scene = new Group();
  scene.add(new Mesh(new BufferGeometry(), material));
  return scene;
}
