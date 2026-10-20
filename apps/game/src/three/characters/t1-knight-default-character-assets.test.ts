import { Bone, BoxGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadT1KnightDefaultCharacterAssetTemplate,
  validateT1KnightDefaultCharacterAsset,
} from "./t1-knight-default-character-assets";
import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";
import { ProceduralCharacterLibrary } from "./procedural-character-assets";
import { prepareProceduralUnitAssembly } from "./procedural-unit-assembly";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";

function riggedFixture(): GLTF {
  const scene = new Group();
  for (const name of resolveHumanoidRigRequiredBoneNames(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER)) {
    const bone = new Bone();
    bone.name = name;
    scene.add(bone);
  }
  const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.bind(new Skeleton(scene.children as Bone[]));
  scene.add(mesh);
  return { scene, animations: [] } as unknown as GLTF;
}

afterEach(() => vi.restoreAllMocks());

describe("T1 Knight asset registration", () => {
  it("keeps Knight appearance and gear restricted to Knight actors", () => {
    const base = createDefaultProceduralUnitConfig();
    const knight = applyProceduralUnitConfigPatch(base, { kind: "knight" });
    const paladin = applyProceduralUnitConfigPatch(base, { kind: "paladin" });
    const t1KnightDefault = {
      ...knight,
      humanoid: { ...knight.humanoid, appearanceId: "t1-knight-default" as const },
      melee: {
        ...knight.melee,
        weaponId: "t1-knight-default-sword" as const,
        offhandId: "t1-knight-default-shield" as const,
      },
    };
    expect(prepareProceduralUnitAssembly(t1KnightDefault).melee).toMatchObject({
      weaponId: "t1-knight-default-sword",
      offhandId: "t1-knight-default-shield",
    });
    expect(() => prepareProceduralUnitAssembly({ ...paladin, humanoid: t1KnightDefault.humanoid })).toThrow(
      "incompatible",
    );
    expect(() => prepareProceduralUnitAssembly({ ...paladin, melee: t1KnightDefault.melee })).toThrow("incompatible");
  });

  it("fetches only the requested LOD, shares concurrent preparation, and reuses a completed load on return", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async () => riggedFixture());
    const library = new ProceduralCharacterLibrary([]);
    const mid = { appearanceId: "t1-knight-default", tier: 1, renderDetail: "crowd" } as const;
    const near = { ...mid, renderDetail: "hero" } as const;
    try {
      expect(load).not.toHaveBeenCalled();
      await Promise.all([library.prepare(mid), library.prepare(mid)]);
      expect(library.isReady(mid)).toBe(true);
      expect(library.isReady(near)).toBe(false);
      expect(load.mock.calls.map(([url]) => url)).toEqual(["/models/characters/t1-knight-default/mid/skin.glb"]);
      await library.prepare(mid);
      expect(load).toHaveBeenCalledTimes(1);
      await library.prepare(near);
      expect(library.isReady(near)).toBe(true);
      expect(load.mock.calls.map(([url]) => url)).toEqual([
        "/models/characters/t1-knight-default/mid/skin.glb",
        "/models/characters/t1-knight-default/near/skin.glb",
      ]);
    } finally {
      library.dispose();
    }
  });

  it("retries a rejected LOD request instead of retaining the rejected promise", async () => {
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementationOnce(async () => riggedFixture());
    const library = new ProceduralCharacterLibrary([]);
    const config = { appearanceId: "t1-knight-default", tier: 1, renderDetail: "crowd" } as const;
    try {
      await expect(library.prepare(config)).rejects.toThrow("network");
      expect(library.isReady(config)).toBe(false);
      await library.prepare(config);
      expect(library.isReady(config)).toBe(true);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      library.dispose();
    }
  });

  it("validates each requested skin before registering it", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async () => riggedFixture());
    const templates = await Promise.all([
      loadT1KnightDefaultCharacterAssetTemplate("hero"),
      loadT1KnightDefaultCharacterAssetTemplate("crowd"),
    ]);
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/models/characters/t1-knight-default/near/skin.glb",
      "/models/characters/t1-knight-default/mid/skin.glb",
    ]);
    expect(templates.map(({ id }) => id)).toEqual(["t1-knight-default-near", "t1-knight-default-mid"]);
    for (const template of templates) {
      template.gltf.scene.traverse((node) => {
        if (!(node instanceof SkinnedMesh)) return;
        node.geometry.dispose();
        (node.material as MeshStandardMaterial).dispose();
      });
    }
  });

  it("rejects incomplete, unskinned and clipped exports", () => {
    const valid = riggedFixture();
    expect(() => validateT1KnightDefaultCharacterAsset(valid, "near")).not.toThrow();
    expect(() =>
      validateT1KnightDefaultCharacterAsset({ ...valid, animations: [{} as GLTF["animations"][number]] }, "near"),
    ).toThrow("clip-free");
    const missing = riggedFixture();
    missing.scene.getObjectByName("hand_r")?.removeFromParent();
    expect(() => validateT1KnightDefaultCharacterAsset(missing, "near")).toThrow("missing Knight bones");
    expect(() => validateT1KnightDefaultCharacterAsset({ ...valid, scene: new Group() }, "near")).toThrow();
  });
});
