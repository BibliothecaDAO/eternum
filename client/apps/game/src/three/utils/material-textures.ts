import type { Material, Texture } from "three";

type TextureLike = Texture & { isTexture?: boolean };

export function collectMaterialTextures(material: Material, textures: Set<Texture>): void {
  Object.values(material).forEach((value) => addTexture(value, textures));
}

function addTexture(value: unknown, textures: Set<Texture>): void {
  if (value && typeof value === "object" && (value as TextureLike).isTexture) {
    textures.add(value as Texture);
  }
}
