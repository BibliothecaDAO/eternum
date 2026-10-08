import { Bone, BoxGeometry, Group, MeshStandardMaterial, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadBastionKnightCharacterAssetTemplates,
  validateBastionKnightCharacterAsset,
} from "./bastion-knight-character-assets";
import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";
import { prepareProceduralUnitAssembly } from "./procedural-unit-assembly";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";

function riggedFixture(): GLTF {
  const scene = new Group();
  for (const name of resolveHumanoidRigRequiredBoneNames(BASTION_KNIGHT_HUMANOID_RIG_ADAPTER)) {
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
    const bastion = {
      ...knight,
      humanoid: { ...knight.humanoid, appearanceId: "t1-knight-bastion-default" as const },
      melee: {
        ...knight.melee,
        weaponId: "t1-knight-bastion-sword" as const,
        offhandId: "t1-knight-bastion-shield" as const,
      },
    };
    expect(prepareProceduralUnitAssembly(bastion).melee).toMatchObject({
      weaponId: "t1-knight-bastion-sword",
      offhandId: "t1-knight-bastion-shield",
    });
    expect(() => prepareProceduralUnitAssembly({ ...paladin, humanoid: bastion.humanoid })).toThrow("incompatible");
    expect(() => prepareProceduralUnitAssembly({ ...paladin, melee: bastion.melee })).toThrow("incompatible");
  });

  it("loads near and mid skins only through the explicit helper", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async () => riggedFixture());
    const templates = await loadBastionKnightCharacterAssetTemplates();
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/models/characters/t1-knight-default/near/skin.glb",
      "/models/characters/t1-knight-default/mid/skin.glb",
    ]);
    expect(templates.map(({ id }) => id)).toEqual(["t1-knight-bastion-near", "t1-knight-bastion-mid"]);
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
    expect(() => validateBastionKnightCharacterAsset(valid, "near")).not.toThrow();
    expect(() =>
      validateBastionKnightCharacterAsset({ ...valid, animations: [{} as GLTF["animations"][number]] }, "near"),
    ).toThrow("clip-free");
    const missing = riggedFixture();
    missing.scene.getObjectByName("hand_r")?.removeFromParent();
    expect(() => validateBastionKnightCharacterAsset(missing, "near")).toThrow("missing Knight bones");
    expect(() => validateBastionKnightCharacterAsset({ ...valid, scene: new Group() }, "near")).toThrow();
  });
});
