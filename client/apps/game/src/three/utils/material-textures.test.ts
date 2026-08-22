import { MeshStandardMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";

import { collectMaterialTextures } from "./material-textures";

describe("material texture collection", () => {
  it("deduplicates every texture referenced by a material", () => {
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture, normalMap: texture });

    expect([...collectMaterialTextureSet(material)]).toEqual([texture]);
  });
});

function collectMaterialTextureSet(material: MeshStandardMaterial): Set<Texture> {
  const textures = new Set<Texture>();
  collectMaterialTextures(material, textures);
  return textures;
}
