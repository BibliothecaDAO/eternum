import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: {
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock("@/config/game-modes", () => ({
  getGameModeConfig: vi.fn(() => ({
    assets: {
      structureModelPaths: {},
      labels: {
        fragmentMine: "",
      },
    },
  })),
}));

vi.mock("@/three/managers/instanced-model", () => ({
  default: class MockInstancedModel {},
  LAND_NAME: "LAND",
}));

vi.mock("@/three/scenes/hexagon-scene", () => ({
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
  HexagonScene: class MockHexagonScene {},
}));

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: { load: vi.fn() },
  isAddressEqualToAccount: vi.fn(() => false),
}));

vi.mock("@/ui/config", () => ({
  FELT_CENTER: () => 0,
}));

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );
  return new Proxy(
    {
      BuildingType: enumProxy,
      StructureType: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: vi.fn(),
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: vi.fn(),
}));

vi.mock("starknet", () => ({
  shortString: {
    decodeShortString: vi.fn(() => ""),
  },
}));

vi.mock("../cosmetics", () => ({
  CosmeticAttachmentManager: class MockCosmeticAttachmentManager {
    clear() {}
    removeAttachments() {}
    ensureAttachments() {}
    setVisibleByEntity() {}
  },
  findCosmeticById: vi.fn(),
  playerCosmeticsStore: {
    hydrateFromBlitzComponent: vi.fn(),
  },
  resolveStructureCosmetic: vi.fn(() => ({
    cosmeticId: "default",
    registryEntry: undefined,
    attachments: [],
  })),
  resolveStructureMountTransforms: vi.fn(() => []),
}));

vi.mock("../cosmetics/skin-asset-source", () => ({
  resolveAllSkinGltfs: vi.fn(async () => []),
}));

vi.mock("../utils/chunk-geometry", () => ({
  getRenderBounds: vi.fn(() => ({ minCol: 0, minRow: 0, maxCol: 0, maxRow: 0 })),
}));

vi.mock("../utils", () => ({
  getWorldPositionForHex: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  getWorldPositionForHexCoordsInto: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  hashCoordinates: vi.fn(() => "0,0"),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft: vi.fn(() => 0),
  getCombatAngles: vi.fn(() => ({ attackedFromDegrees: undefined, attackTowardDegrees: undefined })),
}));

vi.mock("../utils/labels/label-factory", () => ({
  createStructureLabel: vi.fn(),
  updateStructureLabel: vi.fn(),
}));

vi.mock("../utils/labels/label-pool", () => ({
  LabelPool: class MockLabelPool {
    release() {}
    clear() {}
  },
}));

vi.mock("./fx-manager", () => ({
  FXManager: class MockFXManager {},
}));

vi.mock("./manager-update-convergence", () => ({
  createCoalescedAsyncUpdateRunner: (fn: () => Promise<void>) => fn,
  isCommittedManagerChunk: vi.fn(() => true),
  MANAGER_UNCOMMITTED_CHUNK: "uncommitted",
  shouldAcceptManagerChunkRequest: vi.fn(() => true),
  shouldRunManagerChunkUpdate: vi.fn(() => true),
  waitForVisualSettle: vi.fn(async () => {}),
}));

vi.mock("./points-label-renderer", () => ({
  PointsLabelRenderer: class MockPointsLabelRenderer {
    dispose() {}
  },
}));

const { StructureManager } = await import("./structure-manager");

function createSubject() {
  const subject = Object.create(StructureManager.prototype) as any;
  subject.chunkAssetPrewarmPromises = new Map();
  subject.getVisibleStructuresForChunk = vi.fn();
  subject.ensureStructureModels = vi.fn(async () => []);
  subject.ensureCosmeticStructureModels = vi.fn(async () => []);
  subject.hasCosmeticSkin = vi.fn((structure: { cosmeticId?: string; cosmeticAssetPaths?: string[] }) => {
    return Boolean(structure.cosmeticId && structure.cosmeticAssetPaths?.length);
  });
  return subject;
}

describe("StructureManager.prewarmChunkAssets", () => {
  it("loads visible chunk structure models before the visible update path runs", async () => {
    const subject = createSubject();
    subject.getVisibleStructuresForChunk.mockReturnValue([
      { structureType: "Village" },
      { structureType: "Village" },
      { structureType: "Bank" },
    ]);

    await subject.prewarmChunkAssets("24,24");

    expect(subject.getVisibleStructuresForChunk).toHaveBeenCalledWith(24, 24);
    expect(subject.ensureStructureModels.mock.calls).toEqual([["Village"], ["Bank"]]);
    expect(subject.ensureCosmeticStructureModels).not.toHaveBeenCalled();
  });

  it("loads visible chunk cosmetic models before the visible update path runs", async () => {
    const subject = createSubject();
    subject.getVisibleStructuresForChunk.mockReturnValue([
      {
        structureType: "Village",
        cosmeticId: "skin-a",
        cosmeticAssetPaths: ["/skins/a.glb"],
      },
    ]);

    await subject.prewarmChunkAssets("24,24");

    expect(subject.ensureStructureModels).not.toHaveBeenCalled();
    expect(subject.ensureCosmeticStructureModels).toHaveBeenCalledWith("skin-a", ["/skins/a.glb"]);
  });

  it("dedupes concurrent prewarm requests for the same chunk assets", async () => {
    const subject = createSubject();
    let resolveStructureModels: (() => void) | null = null;
    subject.getVisibleStructuresForChunk.mockReturnValue([{ structureType: "Village" }]);
    subject.ensureStructureModels.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStructureModels = resolve;
        }),
    );

    const first = subject.prewarmChunkAssets("24,24");
    const second = subject.prewarmChunkAssets("24,24");

    expect(subject.ensureStructureModels).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resolveStructureModels?.();
    await Promise.all([first, second]);
    expect(subject.chunkAssetPrewarmPromises.size).toBe(0);
  });
});
