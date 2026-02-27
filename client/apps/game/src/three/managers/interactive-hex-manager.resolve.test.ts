// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: {
    getState: () => ({
      account: { address: "0" },
    }),
  },
}));

vi.mock("three-stdlib", () => ({
  DRACOLoader: class {
    setDecoderPath() {}
    preload() {}
  },
  GLTFLoader: class {
    setDRACOLoader() {}
    setMeshoptDecoder() {}
  },
  MeshoptDecoder: () => ({}),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  calculateDistance: () => 0,
  FELT_CENTER: () => 0,
}));

vi.mock("@bibliothecadao/types", () => ({
  ContractAddress: (value: string) => value,
  BuildingType: {
    ResourceLabor: "ResourceLabor",
    ResourceAncientFragment: "ResourceAncientFragment",
    ResourceStone: "ResourceStone",
    ResourceCoal: "ResourceCoal",
    ResourceCopper: "ResourceCopper",
    ResourceObsidian: "ResourceObsidian",
    ResourceSilver: "ResourceSilver",
    ResourceIronwood: "ResourceIronwood",
    ResourceColdIron: "ResourceColdIron",
    ResourceGold: "ResourceGold",
    ResourceHartwood: "ResourceHartwood",
    ResourceDiamonds: "ResourceDiamonds",
    ResourceSapphire: "ResourceSapphire",
    ResourceRuby: "ResourceRuby",
    ResourceDeepCrystal: "ResourceDeepCrystal",
    ResourceIgnium: "ResourceIgnium",
    ResourceEtherealSilica: "ResourceEtherealSilica",
    ResourceTrueIce: "ResourceTrueIce",
    ResourceTwilightQuartz: "ResourceTwilightQuartz",
    ResourceAlchemicalSilver: "ResourceAlchemicalSilver",
    ResourceAdamantine: "ResourceAdamantine",
    ResourceMithral: "ResourceMithral",
    ResourceDragonhide: "ResourceDragonhide",
    ResourceWheat: "ResourceWheat",
    ResourceFish: "ResourceFish",
    ResourceWoods: "ResourceWoods",
    ResourceOlive: "ResourceOlive",
    ResourceWine: "ResourceWine",
  },
  ResourceMiningTypes: {},
}));

vi.mock("@/three/constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("@/three/managers/aura", () => ({
  Aura: class {
    setPosition() {}
    isInScene() {
      return false;
    }
    addToScene() {}
    removeFromScene() {}
    rotate() {}
    dispose() {}
  },
}));

vi.mock("@/three/managers/hover-hex-manager", () => ({
  HoverHexManager: class {
    showHover() {}
    hideHover() {}
    update() {}
    dispose() {}
    setHoverColor() {}
    setHoverIntensity() {}
  },
}));

vi.mock("@/three/utils/hex-geometry-debug", () => ({
  hexGeometryDebugger: {
    trackSharedGeometryUsage() {},
  },
}));

const { InteractiveHexManager } = await import("./interactive-hex-manager");

function createResolveSubject(visibleHexKeys: string[]): InteractiveHexManager {
  const subject = Object.create(InteractiveHexManager.prototype) as InteractiveHexManager & {
    visibleHexes: Set<string>;
    allHexes: Set<string>;
    isRenderingAllHexes: boolean;
    position: THREE.Vector3;
  };

  subject.visibleHexes = new Set(visibleHexKeys);
  subject.allHexes = new Set();
  subject.isRenderingAllHexes = false;
  subject.position = new THREE.Vector3();

  return subject;
}

describe("InteractiveHexManager resolveHexFromPoint", () => {
  it("resolves a boundary pick to the nearest visible hex instead of dropping it", () => {
    const subject = createResolveSubject(["1,1"]);

    const resolved = (subject as any).resolveHexFromPoint(new THREE.Vector3(0.86, 0, 0.51));

    expect(resolved).not.toBeNull();
    expect(resolved.hexCoords).toEqual({ col: 1, row: 1 });
    expect(resolved.position.x).toBeCloseTo(0.8660254, 5);
    expect(resolved.position.z).toBeCloseTo(1.5, 5);
  });

  it("does not drift one neighbor when multiple adjacent hexes are interactive", () => {
    const subject = createResolveSubject(["0,-1", "0,-2"]);

    const resolved = (subject as any).resolveHexFromPoint(new THREE.Vector3(-0.86, 0, -2.48));

    expect(resolved).not.toBeNull();
    expect(resolved.hexCoords).toEqual({ col: 0, row: -1 });
    expect(resolved.position.z).toBeCloseTo(-1.5, 5);
  });
});
