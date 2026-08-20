import type { Material, Object3D, Texture } from "three";

type TextureLike = Texture & { isTexture?: boolean };
type MaterialOwner = Object3D & {
  material?: Material | Material[];
  morphTexture?: Texture | null;
};

export function collectMaterialTextures(material: Material, textures: Set<Texture>): void {
  Object.values(material).forEach((value) => addTexture(value, textures));
}

export function collectObjectTextures(root: Object3D, textures: Set<Texture> = new Set()): Set<Texture> {
  addTexture((root as Object3D & { background?: unknown }).background, textures);
  addTexture((root as Object3D & { environment?: unknown }).environment, textures);

  root.traverse((object) => {
    const owner = object as MaterialOwner;
    const materials = owner.material ? (Array.isArray(owner.material) ? owner.material : [owner.material]) : [];
    materials.forEach((material) => collectMaterialTextures(material, textures));
    addTexture(owner.morphTexture, textures);
  });

  return textures;
}

function addTexture(value: unknown, textures: Set<Texture>): void {
  if (value && typeof value === "object" && (value as TextureLike).isTexture) {
    textures.add(value as Texture);
  }
}
