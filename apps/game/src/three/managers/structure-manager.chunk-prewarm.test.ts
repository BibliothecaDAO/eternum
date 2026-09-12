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

vi.mock("@bibliothecadao/eternum", () => {
  const proxy = new Proxy({}, { get: (_, key) => key });
  return new Proxy({ TROOP_TIERS: proxy } as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : proxy),
    has: () => true,
  });
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );
  return new Proxy(
    {
      orders: [],
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
    skin: { cosmeticId: "default", assetPaths: [], isFallback: true, registryEntry: undefined },
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
  createCoalescedAsyncUpdateRunner: (fn: () => Promise<boolean>) => fn,
  isCommittedManagerChunk: vi.fn(() => true),
  MANAGER_UNCOMMITTED_CHUNK: "uncommitted",
  shouldAcceptManagerChunkRequest: vi.fn(() => true),
  shouldRunManagerChunkUpdate: vi.fn(() => true),
  waitForVisualSettle: vi.fn(async () => {}),
}));

const { StructureManager } = await import("./structure-manager");

function createSubject() {
  const subject = Object.create(StructureManager.prototype) as any;
  subject.chunkAssetPrewarmPromises = new Map();
  subject.structureModels = new Map();
  subject.cosmeticStructureModels = new Map();
  subject.queryStructureInfosInChunk = vi.fn();
  subject.ensureStructureModel = vi.fn(async () => []);
  subject.ensureCosmeticStructureModels = vi.fn(async () => []);
  subject.hasCosmeticSkin = vi.fn((structure: { cosmeticId?: string; cosmeticAssetPaths?: string[] }) => {
    return Boolean(structure.cosmeticId && structure.cosmeticAssetPaths?.length);
  });
  return subject;
}

describe("StructureManager.prewarmChunkAssets", () => {
  it("requests only visible realm levels, required wonders, and the procedural hyperstructure kit", async () => {
    const subject = createSubject();
    subject.structureModels.set("Realm", new Map([[1, {}]]));
    subject.queryStructureInfosInChunk.mockReturnValue([
      { structureType: "Realm", level: 1, hasWonder: false },
      { structureType: "Realm", level: 3, hasWonder: true },
      { structureType: "Realm", level: 3, hasWonder: false },
      { structureType: "Hyperstructure", stage: 2 },
    ]);

    await subject.prewarmChunkAssets("24,24");

    expect(subject.ensureStructureModel.mock.calls).toEqual([
      ["Realm", 3],
      ["Realm", 4],
      ["Hyperstructure", 0],
    ]);
  });

  it("loads a newly needed level even when another level is already cached", async () => {
    const subject = createSubject();
    const cached = { group: {} };
    const upgraded = { group: {}, dispose: vi.fn() };
    subject.ensureStructureModel = StructureManager.prototype["ensureStructureModel"];
    subject.structureModels.set("Realm", new Map([[1, cached]]));
    subject.structureModelPromises = new Map();
    subject.structureModelPaths = { Realm: ["zero.glb", "one.glb", "two.glb", "three.glb", "wonder.glb"] };
    subject.loadStructureModel = vi.fn(async () => upgraded);
    let finishCompilation!: () => void;
    subject.compilePipelines = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCompilation = resolve;
        }),
    );
    subject.attachStructureModelsToScene = vi.fn();

    const first = subject.ensureStructureModel("Realm", 2);
    const second = subject.ensureStructureModel("Realm", 2);
    await vi.waitFor(() => expect(subject.compilePipelines).toHaveBeenCalledTimes(1));
    expect(subject.attachStructureModelsToScene).not.toHaveBeenCalled();
    expect(subject.structureModels.get("Realm").has(2)).toBe(false);
    finishCompilation();
    await Promise.all([first, second]);

    expect(subject.loadStructureModel).toHaveBeenCalledTimes(1);
    expect(subject.loadStructureModel).toHaveBeenCalledWith("Realm", "two.glb");
    expect(subject.compilePipelines).toHaveBeenCalledTimes(1);
    expect(subject.structureModels.get("Realm").get(1)).toBe(cached);
    expect(subject.getModelForStructure({ structureType: "Realm", level: 2 })).toBe(upgraded);
  });

  it("disposes a prepared model if its scene is destroyed during compilation", async () => {
    const subject = createSubject();
    const model = { group: {}, dispose: vi.fn() };
    subject.ensureStructureModel = StructureManager.prototype["ensureStructureModel"];
    subject.structureModelPromises = new Map();
    subject.structureModelPaths = { Village: ["village.glb"] };
    subject.loadStructureModel = vi.fn(async () => model);
    subject.compilePipelines = vi.fn(async () => {
      subject.isDestroyed = true;
    });
    subject.attachStructureModelsToScene = vi.fn();

    await expect(subject.ensureStructureModel("Village", 0)).rejects.toThrow("destroyed");

    expect(model.dispose).toHaveBeenCalledTimes(1);
    expect(subject.structureModels.size).toBe(0);
    expect(subject.structureModelPromises.size).toBe(0);
    expect(subject.attachStructureModelsToScene).not.toHaveBeenCalled();
  });

  it("loads visible chunk structure models before the visible update path runs", async () => {
    const subject = createSubject();
    subject.queryStructureInfosInChunk.mockReturnValue([
      { structureType: "Village", stage: 0 },
      { structureType: "Village", stage: 0 },
      { structureType: "Bank", stage: 0 },
    ]);

    await subject.prewarmChunkAssets("24,24");

    expect(subject.queryStructureInfosInChunk).toHaveBeenCalledWith(24, 24);
    expect(subject.ensureStructureModel.mock.calls).toEqual([
      ["Village", 0],
      ["Bank", 0],
    ]);
    expect(subject.ensureCosmeticStructureModels).not.toHaveBeenCalled();
  });

  it("attaches a loaded structure model to the scene in the current band's visibility", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const group = { visible: true };
    const model = { group, setWorldBounds: vi.fn() };
    subject.structureModels = new Map();
    subject.cosmeticStructureModels = new Map();
    subject.structureModelPromises = new Map();
    subject.structureModelPaths = { Village: ["/village.glb"] };
    subject.loadStructureModel = vi.fn(async () => model);
    subject.scene = { add: vi.fn() };
    subject.currentChunkBounds = undefined;
    subject.currentCameraView = 3;
    subject.metrics = { hiddenModelGroups: 0 };

    await subject.ensureStructureModel("Village", 0);

    expect(subject.scene.add).toHaveBeenCalledWith(group);
    expect(group.visible).toBe(false);
    expect(subject.metrics.hiddenModelGroups).toBe(1);
  });

  it("loads visible chunk cosmetic models before the visible update path runs", async () => {
    const subject = createSubject();
    subject.queryStructureInfosInChunk.mockReturnValue([
      {
        structureType: "Village",
        cosmeticId: "skin-a",
        cosmeticAssetPaths: ["/skins/a.glb"],
      },
    ]);

    await subject.prewarmChunkAssets("24,24");

    expect(subject.ensureStructureModel).not.toHaveBeenCalled();
    expect(subject.ensureCosmeticStructureModels).toHaveBeenCalledWith("skin-a", ["/skins/a.glb"]);
  });

  it("dedupes concurrent prewarm requests for the same chunk assets", async () => {
    const subject = createSubject();
    let resolveStructureModels!: () => void;
    subject.queryStructureInfosInChunk.mockReturnValue([{ structureType: "Village", stage: 0 }]);
    subject.ensureStructureModel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStructureModels = resolve;
        }),
    );

    const first = subject.prewarmChunkAssets("24,24");
    const second = subject.prewarmChunkAssets("24,24");

    expect(subject.ensureStructureModel).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resolveStructureModels();
    await Promise.all([first, second]);
    expect(subject.chunkAssetPrewarmPromises.size).toBe(0);
  });
});
