import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

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
  IS_FLAT_MODE: false,
}));

vi.mock("@bibliothecadao/eternum", () => {
  const eternumProxy = new Proxy({}, { get: (_, key) => key });
  return new Proxy({} as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : eternumProxy),
    has: () => true,
  });
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy({}, { get: (_, key) => key });
  return new Proxy({ BuildingType: enumProxy, StructureType: enumProxy } as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
    has: () => true,
  });
});

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: vi.fn(),
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
    setVisible() {}
  },
  playerCosmeticsStore: {
    hydrateFromBlitzComponent: vi.fn(),
  },
  resolveStructureCosmetic: vi.fn(() => ({
    skin: { cosmeticId: "default", assetPaths: [], isFallback: true },
    attachments: [],
  })),
  resolveStructureMountTransforms: vi.fn(() => []),
}));

vi.mock("../utils/chunk-geometry", () => ({
  getRenderBounds: vi.fn(() => ({ minCol: 0, minRow: 0, maxCol: 0, maxRow: 0 })),
}));

vi.mock("../utils", () => ({
  getWorldPositionForHex: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
  getWorldPositionForHexCoordsInto: vi.fn((_col: number, _row: number, target: THREE.Vector3) => target.set(0, 0, 0)),
  hashCoordinates: vi.fn(() => 0),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft: vi.fn(() => undefined),
}));

vi.mock("../utils/labels/label-factory", () => ({
  createStructureLabel: vi.fn(),
  updateStructureLabel: vi.fn(),
}));

vi.mock("../utils/labels/label-pool", () => ({
  LabelPool: class MockLabelPool {
    release() {}
    clear() {}
    flushBatch() {}
  },
}));

vi.mock("./fx-manager", () => ({
  FXManager: class MockFXManager {},
}));

vi.mock("./manager-update-convergence", () => ({
  createAsyncPassFence: vi.fn(() => ({
    capture: vi.fn(() => ({ version: 0 })),
    invalidate: vi.fn(),
    isCurrent: vi.fn(() => true),
  })),
  createCoalescedAsyncUpdateRunner: (fn: () => Promise<boolean>) => fn,
  isCommittedManagerChunk: vi.fn(() => true),
  MANAGER_UNCOMMITTED_CHUNK: "uncommitted",
  shouldAcceptManagerChunkRequest: vi.fn(() => true),
  shouldRunManagerChunkUpdate: vi.fn(() => true),
  waitForVisualSettle: vi.fn(async () => {}),
}));

const { StructureManager } = await import("./structure-manager");
const { CameraView } = await import("@/three/scenes/hexagon-scene");
const { EMPTY_LABEL_PRIORITY_CONTEXT } = await import("@/three/scenes/worldmap-content-ladder");

type CameraViewListener = (view: number) => void;

function createModel() {
  return {
    group: { visible: true },
    instancedMeshes: [],
    setContactShadowsEnabled: vi.fn(),
    setWorldBounds: vi.fn(),
    updateAnimations: vi.fn(),
  };
}

/** Stands in for a CSS2DObject: a real Object3D (so the labels group accepts it) carrying a DOM-ish element. */
function createHoverLabel(entityId: number) {
  const label = new THREE.Object3D() as THREE.Object3D & { element: { querySelector: () => null; style: object } };
  label.element = { querySelector: () => null, style: {} };
  label.userData.entityId = entityId;
  return label;
}

function createStructure(entityId: number, overrides: Record<string, unknown> = {}) {
  return {
    entityId,
    structureName: `Realm ${entityId}`,
    hexCoords: { col: entityId, row: 0 },
    structureType: "Realm",
    isMine: false,
    isAlly: false,
    owner: { address: BigInt(entityId * 100), ownerName: "", guildName: "" },
    battleTimerLeft: undefined,
    ...overrides,
  };
}

const TOP_OWNER_ADDRESS = 0xabc0n;
const PRIORITY_STRUCTURES = [
  createStructure(1, { isMine: true }),
  createStructure(2, { isAlly: true }),
  createStructure(3, { owner: { address: TOP_OWNER_ADDRESS, ownerName: "", guildName: "" } }),
  createStructure(4),
  createStructure(5),
  createStructure(6),
  createStructure(7, { battleTimerLeft: 30 }),
];
const MID_BAND_CONTEXT = {
  isSpectator: false,
  topOwnerAddresses: new Set([TOP_OWNER_ADDRESS.toString(16)]),
  selectedEntityId: 5,
  hoveredEntityId: 6,
};

/** A real manager wired to a stub scene so band flips travel through the camera-view listener. */
function createLiveManager(structures = PRIORITY_STRUCTURES) {
  vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
  const renderables = structures.map((structure) => ({
    entityId: structure.entityId,
    reserved: false,
    hexCoords: structure.hexCoords,
    occupierType: 1,
  }));
  const listeners = new Set<CameraViewListener>();
  const hexagonScene = {
    getCurrentCameraView: () => CameraView.Close,
    addCameraViewListener: (listener: CameraViewListener) => listeners.add(listener),
    removeCameraViewListener: (listener: CameraViewListener) => listeners.delete(listener),
    getShadowsEnabled: () => true,
    getCamera: () => undefined,
    getTerrainSurface: () => undefined,
  };
  const worldSpatialProjection = {
    subscribeStructures: vi.fn(() => vi.fn()),
    getStructure: vi.fn((entityId: number) => renderables.find((renderable) => renderable.entityId === entityId)),
  };
  const labelsGroup = new THREE.Group();

  const manager = new StructureManager(
    new THREE.Scene(),
    { width: 48, height: 48 },
    worldSpatialProjection as never,
    {} as never,
    labelsGroup,
    hexagonScene as never,
  ) as any;

  const models = { realm: createModel(), wonder: createModel(), skin: createModel() };
  manager.structureModels = new Map([["Realm", [models.realm, models.wonder]]]);
  manager.cosmeticStructureModels = new Map([["skin", [models.skin]]]);
  manager.attachmentManager = { setVisible: vi.fn(), clear: vi.fn(), removeAttachments: vi.fn() };
  manager.compactLabelRenderer = { setLabel: vi.fn(), removeLabel: vi.fn(), clear: vi.fn(), dispose: vi.fn() };
  manager.refreshTrackedStructureLabelOrPrune = vi.fn();
  manager.entityIdLabels.set(6, createHoverLabel(6));
  manager.visibleStructureWindow = {
    chunkKey: "0,0",
    bounds: { minCol: -10, maxCol: 10, minRow: -10, maxRow: 10 },
    structures: new Map(renderables.map((renderable) => [renderable.entityId, renderable])),
  };
  structures.forEach((structure) => manager.structureInfoCache.set(structure.entityId, structure));
  manager.previousVisibleIds = new Set(structures.map((structure) => structure.entityId));

  const fireCameraView = (view: number) => listeners.forEach((listener) => listener(view));
  const modelGroupsVisible = () => Object.values(models).map((model) => model.group.visible);
  const labelledIds = () =>
    manager.compactLabelRenderer.setLabel.mock.calls.map(([input]: [{ entityId: number }]) => input.entityId);
  const unlabelledIds = () =>
    manager.compactLabelRenderer.removeLabel.mock.calls.map(([entityId]: [number]) => entityId);
  const seedShownLabels = () => structures.forEach((structure) => manager.compactLabelIds.add(structure.entityId));

  return {
    manager,
    models,
    labelsGroup,
    fireCameraView,
    modelGroupsVisible,
    labelledIds,
    unlabelledIds,
    seedShownLabels,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StructureManager content ladder", () => {
  it("far band hides every model group and drops every near/mid label", () => {
    const live = createLiveManager();
    live.seedShownLabels();

    live.fireCameraView(CameraView.Far);

    expect(live.modelGroupsVisible()).toEqual([false, false, false]);
    expect(live.manager.attachmentManager.setVisible).toHaveBeenLastCalledWith(false);
    expect(live.manager.compactLabelRenderer.clear).toHaveBeenCalledTimes(1);
    expect(live.manager.compactLabelIds.size).toBe(0);
    expect(live.labelsGroup.visible).toBe(false);
    expect(live.manager.getStructureManagerMetrics()).toMatchObject({ hiddenModelGroups: 3, compactLabelsShown: 0 });

    live.manager.updateAnimations(0.016);
    Object.values(live.models).forEach((model) => expect(model.updateAnimations).not.toHaveBeenCalled());

    live.manager.destroy();
  });

  it("mid band keeps text only for priority structures and re-evaluates when the scene pushes new facts", () => {
    const live = createLiveManager();
    live.seedShownLabels();
    live.manager.setLabelPriorityContext(MID_BAND_CONTEXT);
    expect(live.manager.compactLabelRenderer.removeLabel).not.toHaveBeenCalled();

    live.fireCameraView(CameraView.Medium);

    expect(live.modelGroupsVisible()).toEqual([true, true, true]);
    expect(live.labelsGroup.visible).toBe(true);
    expect(live.unlabelledIds()).toEqual([4]);
    expect(live.labelledIds()).toEqual([]);
    expect(live.manager.getStructureManagerMetrics().compactLabelsShown).toBe(6);

    live.manager.setLabelPriorityContext({ ...MID_BAND_CONTEXT, isSpectator: true });

    expect(live.unlabelledIds()).toEqual([4, 1, 2, 3]);
    expect(live.labelledIds()).toEqual([]);
    expect([...live.manager.compactLabelIds].toSorted()).toEqual([5, 6, 7]);

    live.manager.destroy();
  });

  it("near band restores every model group, attachment and text label", () => {
    const live = createLiveManager();
    live.fireCameraView(CameraView.Far);
    live.manager.setLabelPriorityContext(MID_BAND_CONTEXT);

    live.fireCameraView(CameraView.Close);

    expect(live.modelGroupsVisible()).toEqual([true, true, true]);
    expect(live.manager.attachmentManager.setVisible).toHaveBeenLastCalledWith(true);
    expect(live.labelsGroup.visible).toBe(true);
    expect(live.labelledIds().toSorted()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(live.manager.refreshTrackedStructureLabelOrPrune).toHaveBeenCalledWith(6);
    expect(live.manager.getStructureManagerMetrics()).toMatchObject({ hiddenModelGroups: 0, compactLabelsShown: 7 });

    live.manager.updateAnimations(0.016);
    Object.values(live.models).forEach((model) => expect(model.updateAnimations).toHaveBeenCalledTimes(1));

    live.manager.destroy();
  });

  it("creates a compact label through the same gate the visible pass uses", () => {
    const live = createLiveManager();
    live.fireCameraView(CameraView.Medium);
    live.manager.setLabelPriorityContext(MID_BAND_CONTEXT);
    live.manager.compactLabelRenderer.setLabel.mockClear();
    live.manager.compactLabelRenderer.removeLabel.mockClear();

    live.manager.updateStructureCompactLabel(PRIORITY_STRUCTURES[3], new THREE.Vector3());
    live.manager.updateStructureCompactLabel(PRIORITY_STRUCTURES[0], new THREE.Vector3());

    expect(live.unlabelledIds()).toEqual([4]);
    expect(live.labelledIds()).toEqual([1]);

    live.manager.destroy();
  });
});

function createVisibleStructurePassFence() {
  let fenceVersion = 0;
  return {
    capture: vi.fn(() => ({ version: fenceVersion })),
    invalidate: vi.fn(() => {
      fenceVersion += 1;
    }),
    isCurrent: vi.fn((snapshot: { version: number }) => snapshot.version === fenceVersion),
  };
}

function createFullRefreshSubject(structureCount: number) {
  const subject = Object.create(StructureManager.prototype) as any;
  const model = { removeInstance: vi.fn(), setCount: vi.fn(), setMatrixAt: vi.fn() };
  const structures = Array.from({ length: structureCount }, (_, index) => ({
    entityId: index + 1,
    hasWonder: false,
    hexCoords: { col: index, row: 0 },
    stage: 0,
    structureType: "Village",
  }));
  const scheduledOwners: string[] = [];

  subject.isDestroyed = false;
  subject.currentChunk = "24,24";
  subject.latestTransitionToken = 0;
  subject.visibleStructureCount = 0;
  subject.currentChunkBounds = undefined;
  subject.hasPendingModelBounds = false;
  subject.visibleStructurePassFence = createVisibleStructurePassFence();
  subject.structureModels = new Map([["Village", [model]]]);
  subject.cosmeticStructureModels = new Map();
  subject.entityIdMaps = new Map();
  subject.cosmeticEntityIdMaps = new Map();
  subject.wonderEntityIdMaps = new Map();
  subject.structureInstanceBindings = new Map();
  subject.structureInstanceSlots = new Map();
  subject.structureInstanceFreeSlots = new Map();
  subject.structureModelDrawCounts = new Map();
  subject.dummy = { matrix: {} };
  subject.activeStructureAttachmentEntities = new Set();
  subject.structureAttachmentSignatures = new Map();
  subject.entityIdLabels = new Map();
  subject.previousVisibleIds = new Set(structures.map((structure) => structure.entityId));
  subject.structureInfoCache = new Map();
  subject.metrics = { fullRefreshSlices: 0, fullRefreshMaxSliceMs: 0 };
  subject.hasCosmeticSkin = vi.fn(() => false);
  subject.getModelForStructure = vi.fn(() => model);
  subject.resolveVisibleStructuresForChunk = vi.fn(() => structures);
  subject.createStructureModelPreloadPlan = vi.fn(() => ({ missingStructureModels: [], missingCosmeticModels: [] }));
  subject.preloadStructureModels = vi.fn(async () => undefined);
  subject.syncVisibleStructurePresentation = vi.fn();
  subject.resolveVisibleStructureRotationY = vi.fn(() => 0);
  subject.finalizeVisibleStructurePass = vi.fn();
  subject.chunkWorkScheduler = {
    schedule: vi.fn(async (_lane: string, work: () => unknown, owner: string) => {
      scheduledOwners.push(owner);
      return work();
    }),
  };

  // Bind every structure once so the full refresh has real slots to release and re-take.
  subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
    entering: structures,
    leaving: [],
    staying: [],
    visibleIds: structures.map((structure) => structure.entityId),
  });
  model.setMatrixAt.mockClear();
  model.setCount.mockClear();
  subject.finalizeVisibleStructurePass.mockClear();

  return { subject, model, structures, scheduledOwners };
}

/** Each performance.now() read advances 1 ms, so a 6 ms slice holds six structure refreshes. */
function installTickingClock() {
  let nowMs = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (nowMs += 1));
}

describe("StructureManager sliced full refresh", () => {
  it("commits a full refresh in several frame-budget slices under the full-refresh owner", async () => {
    const { subject, model, scheduledOwners } = createFullRefreshSubject(20);
    installTickingClock();

    await expect(subject.performVisibleStructuresUpdate({ refreshExisting: true })).resolves.toBe(true);

    expect(scheduledOwners.length).toBeGreaterThanOrEqual(2);
    expect(new Set(scheduledOwners)).toEqual(new Set(["manager:structure-full-refresh"]));
    expect(model.removeInstance).toHaveBeenCalledTimes(20);
    expect(model.setMatrixAt).toHaveBeenCalledTimes(20);
    expect(subject.finalizeVisibleStructurePass).toHaveBeenCalledTimes(1);
    expect(subject.getStructureManagerMetrics()).toMatchObject({ fullRefreshSlices: scheduledOwners.length });
    expect(subject.getStructureManagerMetrics().fullRefreshMaxSliceMs).toBeGreaterThan(0);
  });

  it("stops a full refresh at the next slice once the pass is superseded", async () => {
    const { subject, model, scheduledOwners } = createFullRefreshSubject(20);
    installTickingClock();
    subject.chunkWorkScheduler.schedule.mockImplementation(
      async (_lane: string, work: () => unknown, owner: string) => {
        scheduledOwners.push(owner);
        const outcome = work();
        subject.visibleStructurePassFence.invalidate();
        return outcome;
      },
    );

    await expect(subject.performVisibleStructuresUpdate({ refreshExisting: true })).resolves.toBe(false);

    expect(scheduledOwners).toHaveLength(2);
    expect(model.setMatrixAt.mock.calls.length).toBeLessThan(20);
    expect(subject.finalizeVisibleStructurePass).not.toHaveBeenCalled();
  });

  it("keeps a targeted refresh as one task", async () => {
    const { subject, scheduledOwners } = createFullRefreshSubject(20);
    installTickingClock();
    subject.commitVisibleStructureDiff = vi.fn(() => true);
    subject.commitVisibleStructureDiffSliced = vi.fn();

    await subject.performVisibleStructuresUpdate({ refreshEntityIds: [1] });

    expect(scheduledOwners).toEqual(["manager:structure-targeted-refresh"]);
    expect(subject.commitVisibleStructureDiff).toHaveBeenCalledTimes(1);
    expect(subject.commitVisibleStructureDiffSliced).not.toHaveBeenCalled();
  });
});
