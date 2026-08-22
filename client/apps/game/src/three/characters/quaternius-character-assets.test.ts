// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  Bone,
  BoxGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";

import {
  QUATERNIUS_CHARACTER_ASSETS,
  QUATERNIUS_REQUIRED_BONE_NAMES,
  QuaterniusCharacterLibrary,
  type LoadedQuaterniusCharacterAsset,
  resolveQuaterniusCharacterAsset,
} from "./quaternius-character-assets";

interface GlbJson {
  animations?: unknown[];
  images?: Array<{ mimeType?: string }>;
  nodes?: Array<{ name?: string }>;
  skins?: Array<{ joints?: number[] }>;
}

describe("Quaternius procedural character assets", () => {
  it("maps each visible upgrade tier to a distinct CC0 character", () => {
    expect(resolveQuaterniusCharacterAsset(1).id).toBe("base");
    expect(resolveQuaterniusCharacterAsset(2).id).toBe("peasant");
    expect(resolveQuaterniusCharacterAsset(3).id).toBe("ranger");
  });

  it.each(Object.values(QUATERNIUS_CHARACTER_ASSETS))("ships $label as a skinned, clip-free runtime GLB", (asset) => {
    const glb = readRuntimeGlb(asset.url);
    const nodeNames = new Set(glb.nodes?.map((node) => node.name).filter(Boolean));

    expect(glb.animations ?? []).toHaveLength(0);
    expect(glb.skins?.length).toBeGreaterThan(0);
    expect(glb.skins?.every((skin) => skin.joints?.length === 65)).toBe(true);
    expect(glb.images?.every((image) => image.mimeType === "image/webp")).toBe(true);
    expect(QUATERNIUS_REQUIRED_BONE_NAMES.filter((name) => !nodeNames.has(name))).toEqual([]);
  });

  it("keeps asset license and provenance beside the runtime files", () => {
    const licensePath = resolve(publicRoot(), "models/characters/quaternius/LICENSE.asset.txt");
    const license = readFileSync(licensePath, "utf8");

    expect(license).toContain("CC0 1.0 Universal");
    expect(license).toContain("quaternius.itch.io/universal-base-characters");
    expect(license).toContain("quaternius.itch.io/modular-character-outfits-fantasy");
  });

  it("shares immutable GPU assets while isolating each actor's skeleton and materials", () => {
    const template = createSkinnedAssetTemplate();
    const library = new QuaterniusCharacterLibrary([template.asset]);
    const first = requireSkinnedMesh(library.instantiate()[0].gltf.scene);
    const second = requireSkinnedMesh(library.instantiate()[0].gltf.scene);

    expect(first.geometry).toBe(template.mesh.geometry);
    expect(second.geometry).toBe(template.mesh.geometry);
    expect(first.material).not.toBe(template.mesh.material);
    expect(second.material).not.toBe(first.material);
    expect(first.skeleton).not.toBe(template.mesh.skeleton);
    expect(second.skeleton).not.toBe(first.skeleton);
    expect(first.skeleton.bones[0]).not.toBe(second.skeleton.bones[0]);
    expect((first.material as MeshStandardMaterial).map).toBe(template.texture);

    (first.material as MeshStandardMaterial).color.set("#ff0000");
    expect((second.material as MeshStandardMaterial).color.getHexString()).not.toBe("ff0000");
  });

  it("disposes its templates once and rejects late actor creation", () => {
    const template = createSkinnedAssetTemplate();
    const library = new QuaterniusCharacterLibrary([template.asset]);
    const geometryDispose = vi.spyOn(template.mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(template.mesh.material as MeshStandardMaterial, "dispose");
    const skeletonDispose = vi.spyOn(template.mesh.skeleton, "dispose");
    const textureDispose = vi.spyOn(template.texture, "dispose");

    library.dispose();
    library.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(skeletonDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(() => library.instantiate()).toThrow("disposed Quaternius character library");
  });
});

function readRuntimeGlb(assetUrl: string): GlbJson {
  const buffer = readFileSync(resolve(publicRoot(), assetUrl.slice(1)));
  expect(buffer.toString("utf8", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as GlbJson;
}

function publicRoot(): string {
  return resolve(process.cwd(), "../../public");
}

function createSkinnedAssetTemplate(): {
  asset: LoadedQuaterniusCharacterAsset;
  mesh: SkinnedMesh;
  texture: Texture;
} {
  const scene = new Group();
  const root = new Bone();
  const child = new Bone();
  const skeleton = new Skeleton([root, child]);
  const geometry = new BoxGeometry(1, 1, 1);
  const vertexCount = geometry.getAttribute("position").count;
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4));
  const weights = new Uint16Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) weights[index * 4] = 1;
  geometry.setAttribute("skinWeight", new Uint16BufferAttribute(weights, 4, true));
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const mesh = new SkinnedMesh(geometry, material);

  root.add(child);
  mesh.add(root);
  mesh.bind(skeleton);
  scene.add(mesh);

  return {
    asset: {
      id: "base",
      label: "Test base",
      tier: 1,
      url: "/test-base.glb",
      gltf: {
        animations: [],
        cameras: [],
        scene,
        scenes: [scene],
      } as unknown as GLTF,
    },
    mesh,
    texture,
  };
}

function requireSkinnedMesh(scene: Group): SkinnedMesh {
  const mesh = scene.children[0];
  if (!(mesh instanceof SkinnedMesh)) throw new Error("Expected a cloned skinned mesh");
  return mesh;
}
