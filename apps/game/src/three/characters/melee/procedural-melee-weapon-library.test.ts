import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Skeleton, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProceduralMeleeWeaponLibrary, validateKnightGear } from "./procedural-melee-weapon-library";

function rigidGear(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  return { scene, animations: [] } as unknown as GLTF;
}

afterEach(() => vi.restoreAllMocks());

describe("procedural melee Knight assets", () => {
  it("does not request Knight exports unless explicitly enabled", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync");
    const library = await ProceduralMeleeWeaponLibrary.create();
    expect(load).not.toHaveBeenCalled();
    expect(library.isWeaponReady("t1-knight-bastion-sword")).toBe(false);
    expect(() =>
      library.assertDirectLoadoutAvailable({
        detailedEquipment: true,
        offhandId: "t1-knight-bastion-shield",
        weaponId: "t1-knight-bastion-sword",
      }),
    ).toThrow("was not loaded");
    expect(() => library.instantiateOffhand("t1-knight-bastion-shield")).toThrow("was not loaded");
    library.dispose();
  });

  it("loads the two rigid exports once through the opt-in path", async () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async () => rigidGear());
    const library = await ProceduralMeleeWeaponLibrary.create({ includeBastionKnight: true });
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/models/characters/t1-knight-default/near/sword.glb",
      "/models/characters/t1-knight-default/near/shield.glb",
    ]);
    expect(() =>
      library.assertDirectLoadoutAvailable({
        detailedEquipment: true,
        offhandId: "t1-knight-bastion-shield",
        weaponId: "t1-knight-bastion-sword",
      }),
    ).not.toThrow();
    expect(library.instantiateWeapon("t1-knight-bastion-sword")?.object.position.toArray()).toEqual([0, 0, 0]);
    expect(library.instantiateOffhand("t1-knight-bastion-shield")?.object.position.toArray()).toEqual([0, 0, 0]);
    library.dispose();
  });

  it("rejects empty, clipped and skinned gear", () => {
    expect(() => validateKnightGear({ animations: [], scene: new Group() }, "t1-knight-bastion-sword")).toThrow(
      "no mesh",
    );
    expect(() =>
      validateKnightGear(
        { animations: [{}] as GLTF["animations"], scene: rigidGear().scene },
        "t1-knight-bastion-sword",
      ),
    ).toThrow("clip-free");
    const scene = rigidGear().scene;
    const skinned = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
    skinned.bind(new Skeleton([]));
    scene.add(skinned);
    expect(() => validateKnightGear({ animations: [], scene }, "t1-knight-bastion-shield")).toThrow("rigid");
  });
});
