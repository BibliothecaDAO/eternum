import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Matrix4,
  ImageLoader,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettlementModel } from "./settlement-model";
import {
  buildingModelPaths,
  BUILDINGS_GROUPS,
  getStructureModelPaths,
  VILLAGE_MODEL_PATH,
  REALM_MODEL_PATHS,
} from "../constants/scene-constants";
import { REALM_NEUTRAL_ROW, resolveRealmBannerRow } from "./settlement-appearance";
import { StructureType, RealmLevelNames, orders } from "@bibliothecadao/types";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshBasicMaterial() }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture(kind: "village" | "realm" = "village") {
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
  banner.userData = { relationshipCloth: "banner", settlementMotion: "banner" };
  const hutCloth = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
  hutCloth.userData.relationshipCloth = "trim";
  hutCloth.userData.settlementMotion = "banner";
  scene.add(timber, banner, hutCloth);
  if (kind === "realm") {
    banner.userData.orderCloth = "banner";
    hutCloth.userData.orderCloth = "trim";
    delete hutCloth.userData.settlementMotion;
  }
  const model = new SettlementModel({ scene, animations: [] } as unknown as GLTF, 4, kind);
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
    expect(timber.geometry.getAttribute("settlementHeraldry")).toBeUndefined();
    expect(flag.geometry.getAttribute("settlementHeraldry").array.slice(0, 3)).toEqual(new Float32Array([0, 1, 2]));
    expect(trim.geometry.getAttribute("settlementHeraldry")).toBe(flag.geometry.getAttribute("settlementHeraldry"));
    expect(banner.geometry.getAttribute("settlementHeraldry")).toBeUndefined();
    expect(hutCloth.geometry.getAttribute("settlementHeraldry")).toBeUndefined();
    model.removeInstance(0);
    model.setMatrixAt(0, new Matrix4());
    model.setRelationshipAt(0, "enemy");
    expect(flag.geometry.getAttribute("settlementHeraldry").array.slice(0, 3)).toEqual(new Float32Array([2, 1, 2]));
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

describe("gameplay realms", () => {
  it.each([false, true])("selects all four approved tiers in both game views (blitz=%s)", (blitz) => {
    const paths = [
      RealmLevelNames.Settlement,
      RealmLevelNames.City,
      RealmLevelNames.Kingdom,
      RealmLevelNames.Empire,
    ].map((level) => REALM_MODEL_PATHS[level]);
    expect(getStructureModelPaths(blitz)[StructureType.Realm].slice(0, 4)).toEqual(paths);
    expect(buildingModelPaths(blitz)[BUILDINGS_GROUPS.REALMS]).toEqual(REALM_MODEL_PATHS);
  });

  it("keeps order zero and other orders independent, and clears reused slots with missing metadata", async () => {
    vi.spyOn(ImageLoader.prototype, "loadAsync").mockResolvedValue({ width: 128, height: 128 } as HTMLImageElement);
    const { model, banner, hutCloth } = fixture("realm");
    await model.prepare();
    model.setCount(3);
    model.setOrderAt(0, 0);
    model.setOrderAt(1, orders.at(-1)!.orderId);
    const [, flag, trim] = model.instancedMeshes;
    const heraldry = flag.geometry.getAttribute("settlementHeraldry");
    expect(heraldry.array.slice(0, 3)).toEqual(
      new Float32Array([resolveRealmBannerRow(0), resolveRealmBannerRow(orders.at(-1)!.orderId), REALM_NEUTRAL_ROW]),
    );
    expect(trim.geometry.getAttribute("settlementHeraldry")).toBe(heraldry);
    expect(trim.geometry).not.toBe(hutCloth.geometry);
    expect(banner.geometry.getAttribute("settlementHeraldry")).toBeUndefined();
    model.removeInstance(0);
    model.setMatrixAt(0, new Matrix4());
    model.setOrderAt(0, undefined);
    expect(heraldry.getX(0)).toBe(REALM_NEUTRAL_ROW);
    expect(heraldry.getX(1)).toBe(resolveRealmBannerRow(orders.at(-1)!.orderId));
    expect(() => model.setOrderAt(0, -1)).toThrow("Unknown realm order");
    const disposeTrim = vi.spyOn(trim.geometry, "dispose");
    model.dispose();
    model.dispose();
    expect(disposeTrim).toHaveBeenCalledOnce();
  });
});
