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
  ProceduralCharacterLibrary,
  type LoadedProceduralCharacterAssetTemplate,
  type LoadedProceduralCharacterAsset,
} from "./procedural-character-assets";
import {
  QUATERNIUS_CHARACTER_ASSETS,
  QUATERNIUS_REQUIRED_BONE_NAMES,
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
    expect(resolveQuaterniusCharacterAsset("base").url).toContain("base-male.glb");
    expect(resolveQuaterniusCharacterAsset("peasant").url).toContain("peasant-male.glb");
    expect(resolveQuaterniusCharacterAsset("ranger").url).toContain("ranger-male.glb");
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
    const library = new ProceduralCharacterLibrary([template.asset]);
    const first = requireSkinnedMesh(library.instantiate("universal-base", 1).gltf.scene);
    const second = requireSkinnedMesh(library.instantiate("universal-base", 3).gltf.scene);

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
    const library = new ProceduralCharacterLibrary([template.asset]);
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
    expect(() => library.instantiate("universal-base", 1)).toThrow("disposed procedural character library");
  });

  it("selects appearance independently from tier while reusing one rig adapter", () => {
    const base = createSkinnedAssetTemplate("base");
    const ranger = createSkinnedAssetTemplate("ranger");
    const library = new ProceduralCharacterLibrary([base.asset, ranger.asset]);

    const fantasy = library.instantiate("modular-fantasy", 3);
    const universal = library.instantiate("universal-base", 3);

    expect(fantasy.id).toBe("ranger");
    expect(universal.id).toBe("base");
    expect(fantasy.adapter).toBe(universal.adapter);
    expect(fantasy.appearanceId).toBe("modular-fantasy");
    expect(universal.appearanceId).toBe("universal-base");

    disposeCharacterInstance(fantasy);
    disposeCharacterInstance(universal);
    library.dispose();
  });

  it("rejects ambiguous duplicate asset ids", () => {
    const base = createSkinnedAssetTemplate("base");

    expect(() => new ProceduralCharacterLibrary([base.asset, base.asset])).toThrow("asset ids must be unique");
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

function createSkinnedAssetTemplate(id: "base" | "ranger" = "base"): {
  asset: LoadedProceduralCharacterAssetTemplate;
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
      adapterId: "quaternius-universal",
      id,
      label: `Test ${id}`,
      url: `/test-${id}.glb`,
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

function disposeCharacterInstance(asset: LoadedProceduralCharacterAsset): void {
  asset.gltf.scene.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    object.skeleton.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function requireSkinnedMesh(scene: Group): SkinnedMesh {
  const mesh = scene.children[0];
  if (!(mesh instanceof SkinnedMesh)) throw new Error("Expected a cloned skinned mesh");
  return mesh;
}
