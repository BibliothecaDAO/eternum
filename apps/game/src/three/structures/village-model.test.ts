import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Matrix4 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VillageModel } from "./village-model";
import {
  buildingModelPaths,
  BUILDINGS_GROUPS,
  getStructureModelPaths,
  VILLAGE_MODEL_PATH,
} from "../constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshBasicMaterial() }),
}));
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
  };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  const scene = new Group();
  const timber = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const banner = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
  banner.userData = { relationshipCloth: true, settlementMotion: "banner" };
  const hutCloth = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
  hutCloth.userData.relationshipCloth = true;
  scene.add(timber, banner, hutCloth);
  const model = new VillageModel({ scene, animations: [] } as unknown as GLTF, 4);
  return { model, scene, banner, hutCloth };
}

describe("gameplay villages", () => {
  it.each([false, true])("selects the approved model in world and local views (blitz=%s)", (blitz) => {
    for (const category of [StructureType.Village, StructureType.Camp] as const) {
      expect(getStructureModelPaths(blitz)[category]).toEqual([VILLAGE_MODEL_PATH]);
      expect(buildingModelPaths(blitz)[BUILDINGS_GROUPS.VILLAGE][category]).toBe(VILLAGE_MODEL_PATH);
    }
  });

  it("keeps simultaneous ownership colors independent when instances are removed and reused", () => {
    const { model, banner, hutCloth } = fixture();
    model.setCount(3);
    for (let index = 0; index < 3; index++) model.setMatrixAt(index, new Matrix4().makeTranslation(index * 3, 0, 0));
    model.setRelationshipAt(0, "owned");
    model.setRelationshipAt(1, "allied");
    model.setRelationshipAt(2, "enemy");
    const [timber, flag, trim] = model.instancedMeshes;
    expect(timber.geometry.getAttribute("villageRelationship")).toBeUndefined();
    expect(flag.geometry.getAttribute("villageRelationship").array.slice(0, 3)).toEqual(new Float32Array([0, 1, 2]));
    expect(trim.geometry.getAttribute("villageRelationship")).toBe(flag.geometry.getAttribute("villageRelationship"));
    expect(banner.geometry.getAttribute("villageRelationship")).toBeUndefined();
    expect(hutCloth.geometry.getAttribute("villageRelationship")).toBeUndefined();
    model.removeInstance(0);
    model.setMatrixAt(0, new Matrix4());
    model.setRelationshipAt(0, "enemy");
    expect(flag.geometry.getAttribute("villageRelationship").array.slice(0, 3)).toEqual(new Float32Array([2, 1, 2]));
    const originalPositions = Array.from(banner.geometry.getAttribute("position").array);
    model.setWind({ windX: 0.4, windZ: 0.6 });
    model.updateAnimations(0.5);
    expect(Array.from(flag.geometry.getAttribute("position").array)).not.toEqual(originalPositions);
    expect(Array.from(banner.geometry.getAttribute("position").array)).toEqual(originalPositions);
    const disposeFlag = vi.spyOn(flag.geometry, "dispose");
    const disposeTrim = vi.spyOn(trim.geometry, "dispose");
    const disposeSource = vi.spyOn(banner.geometry, "dispose");
    model.dispose();
    model.dispose();
    expect(disposeFlag).toHaveBeenCalledOnce();
    expect(disposeTrim).toHaveBeenCalledOnce();
    expect(disposeSource).toHaveBeenCalledOnce();
  });
});
