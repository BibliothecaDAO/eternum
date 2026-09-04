import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type CompressedArrayTexture,
  type Texture,
} from "three";

import { loadKtx2Texture } from "@/three/utils/utils";

import { TERRAIN_GROUND_TEXTURE_PATHS } from "./terrain-ground-catalog";

const [ALBEDO_HEIGHT_PATH, NORMAL_MATERIAL_PATH] = TERRAIN_GROUND_TEXTURE_PATHS;
const LAYER_COUNT = 8;
const MIP_LEVEL_COUNT = 10;
const TRANSFER_BYTES = 3_406_477;

export interface TerrainGroundTextures {
  albedoHeight: CompressedArrayTexture;
  bytes: number;
  layerCount: number;
  normalMaterial: CompressedArrayTexture;
}

export interface TerrainGroundTextureHandle {
  release(): void;
  textures: TerrainGroundTextures;
}

let sharedTextures: TerrainGroundTextures | null = null;
let sharedTexturesPromise: Promise<TerrainGroundTextures> | null = null;
let referenceCount = 0;

export async function acquireTerrainGroundTextures(): Promise<TerrainGroundTextureHandle> {
  sharedTexturesPromise ??= loadTerrainGroundTextures().catch((error) => {
    sharedTexturesPromise = null;
    throw error;
  });
  const textures = await sharedTexturesPromise;
  sharedTextures = textures;
  referenceCount += 1;
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      referenceCount -= 1;
      if (referenceCount > 0 || !sharedTextures) return;
      disposeTerrainGroundTextures(sharedTextures);
      sharedTextures = null;
      sharedTexturesPromise = null;
    },
    textures,
  };
}

async function loadTerrainGroundTextures(): Promise<TerrainGroundTextures> {
  const loadedTextures = await loadTextureArrayPair();
  try {
    const textures = {
      albedoHeight: requireTextureArray(loadedTextures[0], "albedo-height"),
      bytes: TRANSFER_BYTES,
      layerCount: LAYER_COUNT,
      normalMaterial: requireTextureArray(loadedTextures[1], "normal-material"),
    };
    configureTextureArray(textures.albedoHeight, SRGBColorSpace);
    configureTextureArray(textures.normalMaterial, NoColorSpace);
    return textures;
  } catch (error) {
    loadedTextures.forEach((texture) => texture.dispose());
    throw error;
  }
}

async function loadTextureArrayPair(): Promise<[Texture, Texture]> {
  const results = await Promise.allSettled([
    loadKtx2Texture(ALBEDO_HEIGHT_PATH),
    loadKtx2Texture(NORMAL_MATERIAL_PATH),
  ]);
  const loadedTextures = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    loadedTextures.forEach((texture) => texture.dispose());
    throw failure.reason;
  }
  return loadedTextures as [Texture, Texture];
}

function disposeTerrainGroundTextures(textures: TerrainGroundTextures): void {
  textures.albedoHeight.dispose();
  textures.normalMaterial.dispose();
}

function requireTextureArray(texture: Texture, label: string): CompressedArrayTexture {
  const arrayTexture = texture as CompressedArrayTexture;
  if (!arrayTexture.isCompressedArrayTexture) {
    throw new Error(`Terrain ground ${label} did not decode as a compressed texture array`);
  }
  if (arrayTexture.image.depth !== LAYER_COUNT) {
    throw new Error(`Terrain ground ${label} expected ${LAYER_COUNT} layers, received ${arrayTexture.image.depth}`);
  }
  if (arrayTexture.mipmaps.length !== MIP_LEVEL_COUNT) {
    throw new Error(
      `Terrain ground ${label} expected ${MIP_LEVEL_COUNT} mip levels, received ${arrayTexture.mipmaps.length}`,
    );
  }
  return arrayTexture;
}

function configureTextureArray(texture: CompressedArrayTexture, colorSpace: string): void {
  texture.colorSpace = colorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}
