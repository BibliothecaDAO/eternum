import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Texture } from "three";
import { describe, expect, it } from "vitest";

import { collectMaterialTextures, collectObjectTextures } from "./material-textures";

describe("material texture collection", () => {
  it("deduplicates every texture referenced by a material", () => {
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture, normalMap: texture });

    expect([...collectMaterialTextureSet(material)]).toEqual([texture]);
  });

  it("collects scene, material, and instanced morph textures", () => {
    const background = new Texture();
    const materialTexture = new Texture();
    const morphTexture = new Texture();
    const root = new Group() as Group & { background?: Texture };
    root.background = background;

    const mesh = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: materialTexture })) as Mesh & {
      morphTexture?: Texture;
    };
    mesh.morphTexture = morphTexture;
    root.add(mesh);

    expect(collectObjectTextures(root)).toEqual(new Set([background, materialTexture, morphTexture]));
  });
});

function collectMaterialTextureSet(material: MeshStandardMaterial): Set<Texture> {
  const textures = new Set<Texture>();
  collectMaterialTextures(material, textures);
  return textures;
}
