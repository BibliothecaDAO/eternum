import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, MeshBasicMaterial, Scene } from "three";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import { ModelType } from "@/three/types/army";
import { ArmyModel } from "./army-model";

vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: vi.fn(() => null), removeItem: vi.fn(), setItem: vi.fn() },
  });
});

vi.mock("@/ui/config", () => ({ FELT_CENTER: 0, IS_FLAT_MODE: false }));
vi.mock("@/utils/agent", () => ({ getCharacterModel: vi.fn(() => null) }));
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
