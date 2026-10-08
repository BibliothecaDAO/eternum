import { Bone, BoxGeometry, Group, MeshStandardMaterial, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadT1KnightDefaultCharacterAssetTemplates,
  validateT1KnightDefaultCharacterAsset,
} from "./t1-knight-default-character-assets";
import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";
import { prepareProceduralUnitAssembly } from "./procedural-unit-assembly";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";

function riggedFixture(): GLTF {
  const scene = new Group();
  for (const name of resolveHumanoidRigRequiredBoneNames(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER)) {
    const bone = new Bone();
    bone.name = name;
    scene.add(bone);
  }
  scene.add(new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()));
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

  it("loads near and mid skins only through the explicit helper", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async () => riggedFixture());
    const templates = await loadT1KnightDefaultCharacterAssetTemplates();
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
