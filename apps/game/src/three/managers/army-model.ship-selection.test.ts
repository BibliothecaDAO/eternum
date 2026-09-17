import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, MeshBasicMaterial, Scene, Group, Mesh, Vector3, Euler } from "three";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { ModelType } from "@/three/types/army";
import { gltfLoader } from "@/three/utils/utils";
import { ArmyModel } from "./army-model";

vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: vi.fn(() => null), removeItem: vi.fn(), setItem: vi.fn() },
  });
});

vi.mock("@/ui/config", () => ({ FELT_CENTER: 0, IS_FLAT_MODE: false }));
vi.mock("@/three/utils/utils", () => ({ gltfLoader: { load: vi.fn() } }));
vi.mock("../utils", () => ({ getHexForWorldPosition: vi.fn(() => ({ col: 0, row: 0 })) }));
vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: vi.fn(() => ({ geometry: new BoxGeometry(1, 1, 1), material: new MeshBasicMaterial() })),
}));
vi.mock("../utils/material-pool", () => ({
  MaterialPool: { getInstance: vi.fn(() => ({ get: vi.fn(), release: vi.fn() })) },
}));
vi.mock("../utils/memory-monitor", () => ({ MemoryMonitor: class MockMemoryMonitor {} }));
vi.mock("./army-model-materials", () => ({
  createPooledInstancedMaterial: vi.fn(() => new MeshBasicMaterial()),
  releasePooledInstancedMaterial: vi.fn(),
}));

describe("ArmyModel ship selection", () => {
  const subject = new ArmyModel(new Scene());

  it("sails the army's own class and tier on ocean and deep ocean", () => {
    expect(subject.getModelTypeForEntity(1, TroopType.Knight, TroopTier.T1, BiomeType.Ocean)).toBe(
      ModelType.ShipKnight1,
    );
    expect(subject.getModelTypeForEntity(2, TroopType.Crossbowman, TroopTier.T2, BiomeType.DeepOcean)).toBe(
      ModelType.ShipCrossbowman2,
    );
    expect(subject.getModelTypeForEntity(3, TroopType.Paladin, TroopTier.T3, BiomeType.Ocean)).toBe(
      ModelType.ShipPaladin3,
    );
  });

  it("keeps the land model everywhere else", () => {
    expect(subject.getModelTypeForEntity(4, TroopType.Paladin, TroopTier.T3, BiomeType.Grassland)).toBe(
      ModelType.Paladin3,
    );
    expect(subject.getModelTypeForEntity(5, TroopType.Knight, TroopTier.T1, BiomeType.Beach)).toBe(ModelType.Knight1);
  });
});

it("loads ship geometry bow-first for movement, including straight west", async () => {
  const ship = new Group();
  const hull = new BoxGeometry(1, 1, 2).translate(0, 0, -2);
  ship.add(new Mesh(hull, new MeshBasicMaterial()), new Mesh(hull, new MeshBasicMaterial()));
  vi.mocked(gltfLoader.load).mockImplementation((_url, loaded) => {
    loaded({ scene: ship, animations: [] } as any);
    return undefined as any;
  });
  const army = new ArmyModel(new Scene());
  await army.preloadModels([ModelType.ShipKnight1]);
  hull.computeBoundingBox();
  const bow = hull.boundingBox!.getCenter(new Vector3());
  expect(bow.z).toBeCloseTo(0.6);
  bow.applyEuler(new Euler(0, -Math.PI / 2, 0));
  expect(bow.x).toBeCloseTo(-0.6);
  expect(bow.z).toBeCloseTo(0);
});
