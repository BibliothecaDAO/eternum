import { afterEach, describe, expect, it, vi } from "vitest";

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
  const eternumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      StructureTileSystemUpdate: eternumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : eternumProxy),
      has: () => true,
    },
  );
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
  playerCosmeticsStore: {
    hydrateFromBlitzComponent: vi.fn(),
  },
  resolveStructureCosmetic: vi.fn(() => ({
    skin: {
      cosmeticId: "default",
      assetPaths: [],
      isFallback: true,
    },
    attachments: [],
  })),
  resolveStructureMountTransforms: vi.fn(() => []),
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

vi.mock("./points-label-renderer", () => ({
  PointsLabelRenderer: class MockPointsLabelRenderer {
    dispose() {}
  },
}));

const { StructureManager } = await import("./structure-manager");
const { isCommittedManagerChunk } = await import("./manager-update-convergence");
const { createCoalescedAsyncUpdateRunner: createActualCoalescedAsyncUpdateRunner } =
  await vi.importActual<typeof import("./manager-update-convergence")>("./manager-update-convergence");
const { getRenderBounds } = await import("../utils/chunk-geometry");
const actualChunkGeometry = await vi.importActual<typeof import("../utils/chunk-geometry")>("../utils/chunk-geometry");

function mockCanonicalRenderBounds() {
  vi.mocked(getRenderBounds).mockImplementation(actualChunkGeometry.getRenderBounds);
}

afterEach(() => {
  vi.mocked(getRenderBounds).mockReset();
  vi.mocked(getRenderBounds).mockReturnValue({ minCol: 0, minRow: 0, maxCol: 0, maxRow: 0 });
  vi.mocked(isCommittedManagerChunk).mockReturnValue(true);
});

function initializePendingVisibleStructureRefresh(subject: any): void {
  subject.pendingVisibleStructureWorkLane = "visible";
  subject.shouldRefreshExistingStructures = false;
  subject.pendingVisibleStructureRefreshIds = new Set();
  subject.pendingVisibleStructureTransitionToken = undefined;
  subject.runVisibleStructuresUpdate = createActualCoalescedAsyncUpdateRunner(() =>
    subject.flushPendingVisibleStructureRefresh(),
  );
}

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

function createStructureManagerSubject() {
  const subject = Object.create(StructureManager.prototype) as any;

  const unsubscribeFrustum = vi.fn();
  const unsubscribeAccountStore = vi.fn();
  const unsubscribeVisibility = vi.fn();
  const unsubscribeProjection = vi.fn();
  const unsubscribeRecs = vi.fn();
  const removeCameraViewListener = vi.fn();
  const clearAttachmentManager = vi.fn();
  const releaseLabel = vi.fn();
  const clearLabelPool = vi.fn();
  const labelA = { id: "a" };
  const labelB = { id: "b" };
  const removeLabelFromGroup = vi.fn();
  const disposePointsA = vi.fn();
  const disposePointsB = vi.fn();
  const disposeCompactLabels = vi.fn();
  const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

  const structureModelDispose = vi.fn();
  const structureModelParentRemove = vi.fn();
  const cosmeticModelDispose = vi.fn();
  const cosmeticModelParentRemove = vi.fn();

  subject.isDestroyed = false;
  subject.unsubscribeProjection = unsubscribeProjection;
  subject.recsUnsubscribes = [unsubscribeRecs];
  subject.unsubscribeFrustum = unsubscribeFrustum;
  subject.unsubscribeAccountStore = unsubscribeAccountStore;
  subject.unsubscribeVisibility = unsubscribeVisibility;
  subject.hexagonScene = { removeCameraViewListener };
  subject.handleCameraViewChange = vi.fn();
  subject.timedLabelInterval = setInterval(() => {}, 60_000);
  subject.entityIdLabels = new Map([
    [1, labelA],
    [2, labelB],
  ]);
  subject.visibleStructurePassFence = createVisibleStructurePassFence();
  subject.labelsGroup = { remove: removeLabelFromGroup };
  subject.labelPool = {
    release: releaseLabel,
    clear: clearLabelPool,
  };
  subject.attachmentManager = { clear: clearAttachmentManager };
  subject.activeStructureAttachmentEntities = new Set([1]);
  subject.structureAttachmentSignatures = new Map([[1, "sig"]]);
  subject.structureModels = new Map([
    [
      "realm",
      [
        {
          dispose: structureModelDispose,
          group: {
            parent: {
              remove: structureModelParentRemove,
            },
          },
        },
      ],
    ],
  ]);
  subject.cosmeticStructureModels = new Map([
    [
      "skinA",
      [
        {
          dispose: cosmeticModelDispose,
          group: {
            parent: {
              remove: cosmeticModelParentRemove,
            },
          },
        },
      ],
    ],
  ]);
  subject.entityIdMaps = new Map([[1, new Map()]]);
  subject.cosmeticEntityIdMaps = new Map([["skinA", new Map()]]);
  subject.wonderEntityIdMaps = new Map([[1, 1001]]);
  subject.structureInstanceBindings = new Map([[1, []]]);
  subject.structureInstanceSlots = new Map([[{}, [1]]]);
  subject.structureInstanceFreeSlots = new Map();
  subject.structureModelDrawCounts = new Map([[{}, 1]]);
  subject.pendingVisibleStructureRefreshIds = new Set();
  subject.incomingTroopArrivalsByStructure = new Map([[1, []]]);
  subject.battleDirectionsByStructure = new Map([[1, {}]]);
  subject.structuresWithActiveTimedLabels = new Set([1]);
  subject.previousVisibleIds = new Set([1]);
  subject.structureInfoCache = new Map([[1, { entityId: 1 }]]);
  subject.visibleStructureWindow = { chunkKey: "0,0", bounds: {}, structures: new Map([[1, {}]]) };
  subject.pointsRenderers = {
    a: { dispose: disposePointsA },
    b: { dispose: disposePointsB },
  };
  subject.compactLabelRenderer = {
    dispose: disposeCompactLabels,
  };

  return {
    subject,
    unsubscribeFrustum,
    unsubscribeAccountStore,
    unsubscribeVisibility,
    unsubscribeProjection,
    unsubscribeRecs,
    removeCameraViewListener,
    clearAttachmentManager,
    releaseLabel,
    clearLabelPool,
    removeLabelFromGroup,
    structureModelDispose,
    structureModelParentRemove,
    cosmeticModelDispose,
    cosmeticModelParentRemove,
    disposePointsA,
    disposePointsB,
    disposeCompactLabels,
    clearIntervalSpy,
  };
}

function createVisibleStructurePassSubject() {
  const subject = Object.create(StructureManager.prototype) as any;
  const visibleStructurePassFence = createVisibleStructurePassFence();

  subject.isDestroyed = false;
  subject.currentChunk = "24,24";
  subject.latestTransitionToken = 0;
  subject.visibleStructureCount = 0;
  subject.currentChunkBounds = undefined;
  subject.hasPendingModelBounds = false;
  subject.visibleStructurePassFence = visibleStructurePassFence;
  subject.structureModels = new Map();
  subject.cosmeticStructureModels = new Map();
  subject.entityIdMaps = new Map();
  subject.cosmeticEntityIdMaps = new Map();
  subject.wonderEntityIdMaps = new Map();
  subject.structureInstanceBindings = new Map();
  subject.structureInstanceSlots = new Map();
  subject.structureInstanceFreeSlots = new Map();
  subject.structureModelDrawCounts = new Map();
  subject.dummy = { matrix: {} };
  subject.pointsRenderers = undefined;
  subject.activeStructureAttachmentEntities = new Set();
  subject.structureAttachmentSignatures = new Map();
  subject.entityIdLabels = new Map();
  subject.previousVisibleIds = new Set();
  subject.visibleStructureWindow = undefined;
  subject.structureInfoCache = new Map();
  subject.metrics = createZeroMetrics();
  subject.updateTimedLabelTracking = vi.fn();
  subject.finalizeVisibleStructurePass = vi.fn();
  subject.syncVisibleStructurePresentation = vi.fn();
  subject.resolveVisibleStructureRotationY = vi.fn(() => 0);
  subject.createStructureModelPreloadPlan = vi.fn(() => ({
    missingStructureModels: [],
    missingCosmeticModels: [],
  }));

  return { subject, visibleStructurePassFence };
}

function createZeroMetrics() {
  return {
    structureInfoCacheHits: 0,
    structureInfoCacheMisses: 0,
    visibleStructureBoundsQueries: 0,
    visibleStructureChangeSetUpdates: 0,
  };
}

function createStructureRenderable(entityId: number, hexCoords: { col: number; row: number }) {
  return { kind: "structure", spatialId: `entity:${entityId}`, entityId, reserved: false, hexCoords, occupierType: 1 };
}

function createStructureVisibilitySubject() {
  const subject = Object.create(StructureManager.prototype) as any;

  subject.currentChunk = "0,0";
  subject.renderChunkSize = { width: 48, height: 48 };
  subject.chunkStride = 24;
  subject.visibleStructureWindow = undefined;
  subject.metrics = createZeroMetrics();

  return subject;
}

describe("StructureManager structure visibility", () => {
  it("retains structures in the presentation overlap while crossing a chunk boundary", () => {
    mockCanonicalRenderBounds();
    const subject = createStructureVisibilitySubject();
    const structuresById = new Map([
      [
        196,
        {
          entityId: 196,
          hexCoords: { col: -13, row: -9 },
          structureType: "Realm",
        },
      ],
      [
        197,
        {
          entityId: 197,
          hexCoords: { col: -37, row: -9 },
          structureType: "Realm",
        },
      ],
      [
        198,
        {
          entityId: 198,
          hexCoords: { col: -36, row: -9 },
          structureType: "Realm",
        },
      ],
    ]);

    subject.worldSpatialProjection = {
      getStructuresInBounds: vi.fn(({ minCol, maxCol, minRow, maxRow }) =>
        Array.from(structuresById.values()).filter(
          (structure) =>
            structure.hexCoords.col >= minCol &&
            structure.hexCoords.col <= maxCol &&
            structure.hexCoords.row >= minRow &&
            structure.hexCoords.row <= maxRow,
        ),
      ),
    };

    const structureWindow = subject.ensureVisibleStructureWindow("0,0");

    expect([...structureWindow.structures.keys()].toSorted()).toEqual([196, 198]);
    expect(subject.metrics.visibleStructureBoundsQueries).toBe(1);
  });
});

describe("StructureManager structure info cache", () => {
  function createCacheSubject() {
    const subject = Object.create(StructureManager.prototype) as any;
    subject.structureInfoCache = new Map();
    subject.metrics = createZeroMetrics();
    subject.updateTimedLabelTracking = vi.fn();
    subject.buildStructureInfo = vi.fn((renderable: { entityId: number }) => ({
      entityId: renderable.entityId,
      battleCooldownEnd: 0,
    }));
    return subject;
  }

  it("serves repeated resolves from the cache and counts hits and misses", () => {
    const subject = createCacheSubject();
    const renderable = createStructureRenderable(7, { col: 0, row: 0 });

    const first = subject.resolveStructureInfo(renderable);
    const second = subject.resolveStructureInfo(renderable);

    expect(second).toBe(first);
    expect(subject.buildStructureInfo).toHaveBeenCalledTimes(1);
    expect(subject.updateTimedLabelTracking).toHaveBeenCalledWith(7, 0, undefined);
    expect(subject.getStructureManagerMetrics()).toMatchObject({
      structureInfoCacheHits: 1,
      structureInfoCacheMisses: 1,
    });
  });

  it("rebuilds a record after its component row changes", () => {
    const subject = createCacheSubject();
    const callbacks: Record<string, (update: { value: unknown[] }) => void> = {};
    const component = (name: string) => ({
      update$: {
        subscribe: (callback: (update: { value: unknown[] }) => void) => {
          callbacks[name] = callback;
          return { unsubscribe: vi.fn() };
        },
      },
    });

    subject.components = {
      Structure: component("structure"),
      StructureBuildings: component("buildings"),
      Hyperstructure: component("hyperstructure"),
      AddressName: component("addressName"),
    };
    subject.recsUnsubscribes = [];
    subject.entityIdLabels = new Map();
    subject.visibleStructureWindow = undefined;
    subject.worldSpatialProjection = {
      getStructure: vi.fn((entityId: number) => createStructureRenderable(entityId, { col: 0, row: 0 })),
    };
    subject.resolveGuardArmies = vi.fn(() => []);
    subject.playStructureGuardDifferenceFx = vi.fn();
    subject.refreshStructureLabelIfTracked = vi.fn();
    subject.requestVisibleStructuresRefresh = vi.fn();
    subject.subscribeToStructurePresentationComponents();

    const stale = { entityId: 7, stale: true };
    subject.structureInfoCache.set(7, stale);
    callbacks.buildings({ value: [{ entity_id: 7 }, undefined] });
    expect(subject.structureInfoCache.get(7)).not.toBe(stale);
    expect(subject.buildStructureInfo).toHaveBeenCalledTimes(1);

    subject.structureInfoCache.set(7, stale);
    callbacks.hyperstructure({ value: [undefined, { hyperstructure_id: 7 }] });
    expect(subject.structureInfoCache.get(7)).not.toBe(stale);

    subject.structureInfoCache.set(7, stale);
    callbacks.structure({ value: [{ entity_id: 7 }, undefined] });
    expect(subject.structureInfoCache.get(7)).not.toBe(stale);

    subject.structureInfoCache.set(8, stale);
    callbacks.addressName({ value: [{ address: 1n, name: 2n }, undefined] });
    expect(subject.structureInfoCache.size).toBe(0);
    expect(subject.requestVisibleStructuresRefresh).not.toHaveBeenCalled();
  });

  it("drops the cached record when a battle direction changes", () => {
    const subject = createCacheSubject();
    subject.battleDirectionsByStructure = new Map();
    subject.worldSpatialProjection = {
      getStructure: vi.fn((entityId: number) => createStructureRenderable(entityId, { col: 0, row: 0 })),
    };
    subject.refreshStructureLabelIfTracked = vi.fn();
    subject.structureInfoCache.set(7, { entityId: 7, stale: true });

    subject.updateBattleDirection(7, 90, "attacker");

    expect(subject.buildStructureInfo).toHaveBeenCalledTimes(1);
    expect(subject.structureInfoCache.get(7)).toMatchObject({ entityId: 7 });
    expect(subject.structureInfoCache.get(7).stale).toBeUndefined();
  });
});

describe("StructureManager change-set driven visible pass", () => {
  function createWindowedPassSubject() {
    const { subject } = createVisibleStructurePassSubject();
    const model = {};
    const renderables = [1, 2, 3].map((entityId) => createStructureRenderable(entityId, { col: entityId, row: 0 }));

    subject.visibleStructureWindow = {
      chunkKey: subject.currentChunk,
      bounds: { minCol: -10, maxCol: 10, minRow: -10, maxRow: 10 },
      structures: new Map(renderables.map((renderable) => [renderable.entityId, renderable])),
    };
    renderables.forEach((renderable) => {
      subject.structureInfoCache.set(renderable.entityId, {
        entityId: renderable.entityId,
        hexCoords: renderable.hexCoords,
        structureType: "Village",
      });
    });
    subject.buildStructureInfo = vi.fn((renderable: { entityId: number; hexCoords: unknown }) => ({
      entityId: renderable.entityId,
      hexCoords: renderable.hexCoords,
      structureType: "Village",
      rebuilt: true,
    }));
    subject.worldSpatialProjection = { getStructuresInBounds: vi.fn(() => []) };
    subject.previousVisibleIds = new Set([1, 2, 3]);
    subject.getModelForStructure = vi.fn(() => model);
    subject.preloadStructureModels = vi.fn(async () => undefined);
    subject.commitVisibleStructureDiff = vi.fn(() => true);
    subject.removeStructurePresentation = vi.fn();
    initializePendingVisibleStructureRefresh(subject);

    return { subject, renderables };
  }

  it("resolves only the changed entity and runs no bounds query for a batch touching one of N", async () => {
    const { subject, renderables } = createWindowedPassSubject();
    const moved = { ...renderables[1], occupierType: 2 };

    subject.handleStructureProjectionChanges([
      { kind: "structure", spatialId: "entity:2", previous: renderables[1], current: moved },
    ]);
    await vi.waitFor(() => expect(subject.commitVisibleStructureDiff).toHaveBeenCalledTimes(1));

    expect(subject.buildStructureInfo).toHaveBeenCalledTimes(1);
    expect(subject.buildStructureInfo).toHaveBeenCalledWith(moved);
    expect(subject.worldSpatialProjection.getStructuresInBounds).not.toHaveBeenCalled();
    expect(subject.getStructureManagerMetrics()).toEqual({
      structureInfoCacheHits: 2,
      structureInfoCacheMisses: 1,
      visibleStructureBoundsQueries: 0,
      visibleStructureChangeSetUpdates: 1,
    });

    const [, diff] = subject.commitVisibleStructureDiff.mock.calls[0];
    expect(diff.entering).toEqual([expect.objectContaining({ entityId: 2, rebuilt: true })]);
    expect(diff.leaving).toEqual([2]);
    expect(diff.staying.toSorted()).toEqual([1, 3]);
    expect(diff.visibleIds.toSorted()).toEqual([1, 2, 3]);
  });

  it("removes a structure that leaves the window and skips the pass for changes outside it", async () => {
    const { subject, renderables } = createWindowedPassSubject();

    subject.handleStructureProjectionChanges([
      {
        kind: "structure",
        spatialId: "entity:9",
        previous: undefined,
        current: createStructureRenderable(9, { col: 500, row: 500 }),
      },
    ]);
    await Promise.resolve();
    expect(subject.commitVisibleStructureDiff).not.toHaveBeenCalled();
    expect(subject.visibleStructureWindow.structures.has(9)).toBe(false);

    subject.handleStructureProjectionChanges([
      { kind: "structure", spatialId: "entity:2", previous: renderables[1], current: undefined },
    ]);
    await vi.waitFor(() => expect(subject.commitVisibleStructureDiff).toHaveBeenCalledTimes(1));

    expect(subject.removeStructurePresentation).toHaveBeenCalledWith(2);
    expect(subject.visibleStructureWindow.structures.has(2)).toBe(false);
    expect(subject.buildStructureInfo).not.toHaveBeenCalled();
    const [, diff] = subject.commitVisibleStructureDiff.mock.calls[0];
    expect(diff.leaving).toEqual([2]);
    expect(diff.visibleIds.toSorted()).toEqual([1, 3]);
    expect(subject.getStructureManagerMetrics().visibleStructureChangeSetUpdates).toBe(2);
  });

  it("runs exactly one bounds query per chunk change", async () => {
    const { subject } = createVisibleStructurePassSubject();
    const model = {};

    subject.renderChunkSize = { width: 48, height: 48 };
    subject.chunkStride = 24;
    subject.worldSpatialProjection = {
      getStructuresInBounds: vi.fn(() => [createStructureRenderable(1, { col: 0, row: 0 })]),
    };
    subject.buildStructureInfo = vi.fn((renderable: { entityId: number; hexCoords: unknown }) => ({
      entityId: renderable.entityId,
      hexCoords: renderable.hexCoords,
      structureType: "Village",
    }));
    subject.getModelForStructure = vi.fn(() => model);
    subject.preloadStructureModels = vi.fn(async () => undefined);
    subject.commitVisibleStructureDiff = vi.fn(() => true);

    await subject.performVisibleStructuresUpdate();
    await subject.performVisibleStructuresUpdate({ refreshEntityIds: [1] });
    expect(subject.worldSpatialProjection.getStructuresInBounds).toHaveBeenCalledTimes(1);
    expect(subject.visibleStructureWindow.chunkKey).toBe("24,24");

    subject.currentChunk = "48,48";
    await subject.performVisibleStructuresUpdate();

    expect(subject.worldSpatialProjection.getStructuresInBounds).toHaveBeenCalledTimes(2);
    expect(subject.visibleStructureWindow.chunkKey).toBe("48,48");
    expect(subject.getStructureManagerMetrics()).toMatchObject({
      visibleStructureBoundsQueries: 2,
      structureInfoCacheMisses: 1,
      structureInfoCacheHits: 2,
    });
  });
});

describe("StructureManager destroy lifecycle", () => {
  it("runs a single visible-structure rebuild during chunk switches", async () => {
    const subject = Object.create(StructureManager.prototype) as any;

    subject.currentChunk = "0,0";
    subject.latestTransitionToken = 0;
    subject.transitionChunkByToken = new Map();
    subject.chunkSwitchPromise = null;
    subject.visibleStructurePassFence = createVisibleStructurePassFence();
    subject.pruneTransitionChunkHistory = vi.fn();
    subject.updateVisibleStructures = vi.fn().mockResolvedValue(undefined);
    subject.runVisibleStructuresUpdate = subject.updateVisibleStructures;

    await subject.updateChunk("24,24");

    expect(subject.updateVisibleStructures).toHaveBeenCalledTimes(1);
  });

  it("cleans subscriptions, timers, labels, models, and caches", () => {
    const fixture = createStructureManagerSubject();

    fixture.subject.destroy();

    expect(fixture.unsubscribeFrustum).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeAccountStore).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeVisibility).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeProjection).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeRecs).toHaveBeenCalledTimes(1);
    expect(fixture.removeCameraViewListener).toHaveBeenCalledTimes(1);
    expect(fixture.clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(fixture.subject.timedLabelInterval).toBeNull();
    expect(fixture.removeLabelFromGroup).toHaveBeenCalledTimes(2);
    expect(fixture.releaseLabel).toHaveBeenCalledTimes(2);
    expect(fixture.subject.entityIdLabels.size).toBe(0);
    expect(fixture.clearLabelPool).toHaveBeenCalledTimes(1);
    expect(fixture.clearAttachmentManager).toHaveBeenCalledTimes(1);
    expect(fixture.structureModelDispose).toHaveBeenCalledTimes(1);
    expect(fixture.structureModelParentRemove).toHaveBeenCalledTimes(1);
    expect(fixture.cosmeticModelDispose).toHaveBeenCalledTimes(1);
    expect(fixture.cosmeticModelParentRemove).toHaveBeenCalledTimes(1);
    expect(fixture.disposePointsA).toHaveBeenCalledTimes(1);
    expect(fixture.disposePointsB).toHaveBeenCalledTimes(1);
    expect(fixture.disposeCompactLabels).toHaveBeenCalledTimes(1);
    expect(fixture.subject.structureModels.size).toBe(0);
    expect(fixture.subject.cosmeticStructureModels.size).toBe(0);
    expect(fixture.subject.entityIdMaps.size).toBe(0);
    expect(fixture.subject.cosmeticEntityIdMaps.size).toBe(0);
    expect(fixture.subject.wonderEntityIdMaps.size).toBe(0);
    expect(fixture.subject.structureInstanceBindings.size).toBe(0);
    expect(fixture.subject.structureInstanceSlots.size).toBe(0);
    expect(fixture.subject.structureInstanceFreeSlots.size).toBe(0);
    expect(fixture.subject.structureModelDrawCounts.size).toBe(0);
    expect(fixture.subject.pendingVisibleStructureRefreshIds.size).toBe(0);
    expect(fixture.subject.incomingTroopArrivalsByStructure.size).toBe(0);
    expect(fixture.subject.battleDirectionsByStructure.size).toBe(0);
    expect(fixture.subject.structuresWithActiveTimedLabels.size).toBe(0);
    expect(fixture.subject.previousVisibleIds.size).toBe(0);
    expect(fixture.subject.structureInfoCache.size).toBe(0);
    expect(fixture.subject.visibleStructureWindow).toBeUndefined();
  });

  it("is idempotent and skips duplicate cleanup on repeated destroy", () => {
    const fixture = createStructureManagerSubject();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fixture.subject.destroy();
    fixture.subject.destroy();

    expect(fixture.removeCameraViewListener).toHaveBeenCalledTimes(1);
    expect(fixture.structureModelDispose).toHaveBeenCalledTimes(1);
    expect(fixture.cosmeticModelDispose).toHaveBeenCalledTimes(1);
    expect(fixture.disposePointsA).toHaveBeenCalledTimes(1);
    expect(fixture.disposePointsB).toHaveBeenCalledTimes(1);
    expect(fixture.disposeCompactLabels).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("StructureManager already destroyed, skipping cleanup");
  });

  it("stops an async visible-structure refresh from mutating after destroy", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const structureType = "Village";
    const setMatrixAt = vi.fn();
    const setCount = vi.fn();
    let resolveModels: ((value: unknown) => void) | undefined;

    subject.isDestroyed = false;
    subject.currentChunk = "24,24";
    subject.visibleStructureCount = 0;
    subject.visibleStructurePassFence = createVisibleStructurePassFence();
    subject.structureModels = new Map();
    subject.cosmeticStructureModels = new Map();
    subject.entityIdMaps = new Map();
    subject.cosmeticEntityIdMaps = new Map();
    subject.wonderEntityIdMaps = new Map();
    subject.pointsRenderers = undefined;
    subject.activeStructureAttachmentEntities = new Set();
    subject.entityIdLabels = new Map();
    subject.previousVisibleIds = new Set();
    subject.resolveVisibleStructuresForChunk = vi.fn(() => [
      {
        entityId: 1,
        hexCoords: { col: 0, row: 0 },
        structureType,
      },
    ]);
    subject.hasCosmeticSkin = vi.fn(() => false);
    subject.ensureStructureModels = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveModels = resolve;
        }),
    );

    const updatePromise = subject.performVisibleStructuresUpdate();
    subject.isDestroyed = true;
    subject.structureModels.set(structureType, [
      {
        setMatrixAt,
        setCount,
      },
    ]);
    resolveModels?.([]);
    await updatePromise;

    expect(setMatrixAt).not.toHaveBeenCalled();
    expect(setCount).not.toHaveBeenCalled();
  });

  it("drops a stale visible-structure pass when chunk bounds change during preload", async () => {
    const { subject } = createVisibleStructurePassSubject();
    const structureType = "Village";
    const setCount = vi.fn();
    let resolvePreload: (() => void) | undefined;

    subject.structureModels.set(structureType, [{ setCount }]);
    subject.resolveVisibleStructuresForChunk = vi.fn(() => [
      {
        entityId: 1,
        hexCoords: { col: 0, row: 0 },
        structureType,
        plannedCount: 1,
      },
    ]);
    subject.preloadStructureModels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    subject.commitVisibleStructureDiff = vi.fn();

    const updatePromise = subject.performVisibleStructuresUpdate();
    subject.setChunkBounds({ box: {} as never, sphere: {} as never });
    resolvePreload?.();
    await updatePromise;

    expect(subject.commitVisibleStructureDiff).not.toHaveBeenCalled();
    expect(subject.finalizeVisibleStructurePass).not.toHaveBeenCalled();
    expect(setCount).not.toHaveBeenCalled();
  });

  it("discards an older visible refresh when a newer pass supersedes it", async () => {
    const { subject, visibleStructurePassFence } = createVisibleStructurePassSubject();
    const structureType = "Village";
    const committedEntityIds: number[] = [];
    let resolveFirstPreload: (() => void) | undefined;
    let resolveSecondPreload: (() => void) | undefined;
    let visibleStructures = [
      {
        entityId: 1,
        hexCoords: { col: 0, row: 0 },
        structureType,
        plannedCount: 1,
      },
    ];

    const model = {};
    subject.structureModels.set(structureType, [model]);
    subject.getModelForStructure = vi.fn(() => model);
    subject.resolveVisibleStructuresForChunk = vi.fn(() => visibleStructures);
    subject.preloadStructureModels = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstPreload = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecondPreload = resolve;
          }),
      );
    subject.commitVisibleStructureDiff = vi.fn((_snapshot: unknown, diff: { visibleIds: number[] }) => {
      committedEntityIds.push(...diff.visibleIds);
    });

    const firstUpdatePromise = subject.performVisibleStructuresUpdate();
    visibleStructurePassFence.invalidate();
    visibleStructures = [
      {
        entityId: 2,
        hexCoords: { col: 1, row: 1 },
        structureType,
        plannedCount: 2,
      },
    ];
    const secondUpdatePromise = subject.performVisibleStructuresUpdate();

    resolveFirstPreload?.();
    await Promise.resolve();
    resolveSecondPreload?.();
    await Promise.all([firstUpdatePromise, secondUpdatePromise]);

    expect(committedEntityIds).toEqual([2]);
  });

  it("rejects an old structure pass when a newer manager token arrives during preload", async () => {
    const { subject } = createVisibleStructurePassSubject();
    const commitVisibleStructureDiff = vi.fn();
    let resolvePreload: (() => void) | undefined;

    subject.latestTransitionToken = 4;
    subject.resolveVisibleStructuresForChunk = vi.fn(() => []);
    subject.preloadStructureModels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    );
    subject.commitVisibleStructureDiff = commitVisibleStructureDiff;

    const oldPass = subject.performVisibleStructuresUpdate({
      refreshExisting: false,
      transitionToken: 4,
      workLane: "critical",
    });
    subject.latestTransitionToken = 5;
    resolvePreload?.();
    await oldPass;

    expect(commitVisibleStructureDiff).not.toHaveBeenCalled();
  });

  it("owns an ordinary entity update as a targeted diff rather than a full rebuild", async () => {
    const { subject } = createVisibleStructurePassSubject();
    const model = {};
    const structures = [
      { entityId: 1, hexCoords: { col: 0, row: 0 }, structureType: "Village" },
      { entityId: 2, hexCoords: { col: 1, row: 0 }, structureType: "Village" },
    ];
    const scheduledOwners: string[] = [];

    subject.previousVisibleIds = new Set([1, 2]);
    subject.resolveVisibleStructuresForChunk = vi.fn(() => structures);
    subject.getModelForStructure = vi.fn(() => model);
    subject.preloadStructureModels = vi.fn(async () => undefined);
    subject.commitVisibleStructureDiff = vi.fn();
    subject.chunkWorkScheduler = {
      schedule: vi.fn(async (_lane: string, work: () => void, owner: string) => {
        scheduledOwners.push(owner);
        work();
      }),
    };

    await subject.performVisibleStructuresUpdate({ refreshEntityIds: [1] });

    expect(subject.commitVisibleStructureDiff).toHaveBeenCalledWith(expect.anything(), {
      entering: [structures[0]],
      leaving: [1],
      staying: [2],
      visibleIds: [1, 2],
    });
    expect(scheduledOwners).toEqual(["manager:structure-targeted-refresh"]);
    expect(scheduledOwners).not.toContain("manager:structure-full-refresh");
  });

  it("routes a structure component refresh to only that entity", () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const structure = { entityId: 7 };

    subject.structureInfoCache = new Map([[7, { entityId: 7, stale: true }]]);
    subject.visibleStructureWindow = { chunkKey: "0,0", bounds: {}, structures: new Map([[7, {}]]) };
    subject.resolveStructureInfoByEntityId = vi.fn(() => structure);
    subject.refreshStructureLabelIfTracked = vi.fn();
    subject.requestVisibleStructuresRefresh = vi.fn();

    subject.refreshStructurePresentation(7);

    expect(subject.structureInfoCache.has(7)).toBe(false);
    expect(subject.refreshStructureLabelIfTracked).toHaveBeenCalledWith(7, structure);
    expect(subject.requestVisibleStructuresRefresh).toHaveBeenCalledWith({ refreshEntityIds: [7] });
  });

  it("refreshes the label but skips the visible pass for a component change outside the window", () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const structure = { entityId: 7 };

    subject.structureInfoCache = new Map();
    subject.visibleStructureWindow = { chunkKey: "0,0", bounds: {}, structures: new Map([[8, {}]]) };
    subject.resolveStructureInfoByEntityId = vi.fn(() => structure);
    subject.refreshStructureLabelIfTracked = vi.fn();
    subject.requestVisibleStructuresRefresh = vi.fn();

    subject.refreshStructurePresentation(7);

    expect(subject.refreshStructureLabelIfTracked).toHaveBeenCalledWith(7, structure);
    expect(subject.requestVisibleStructuresRefresh).not.toHaveBeenCalled();
  });

  it("prunes a tracked label when an address-name update finds that its structure vanished", () => {
    const subject = Object.create(StructureManager.prototype) as any;

    subject.resolveStructureInfoByEntityId = vi.fn(() => undefined);
    subject.removeStructurePresentation = vi.fn();
    subject.refreshStructureLabelIfTracked = vi.fn();

    subject.refreshTrackedStructureLabelOrPrune(7);

    expect(subject.removeStructurePresentation).toHaveBeenCalledWith(7);
    expect(subject.refreshStructureLabelIfTracked).not.toHaveBeenCalled();
  });

  it("mutates only entering and leaving structure slots and ignores a superseded commit", () => {
    const { subject, visibleStructurePassFence } = createVisibleStructurePassSubject();
    const setMatrixAt = vi.fn();
    const removeInstance = vi.fn();
    const setCount = vi.fn();
    const model = { removeInstance, setCount, setMatrixAt };
    const structure = (entityId: number) => ({
      entityId,
      hasWonder: false,
      hexCoords: { col: entityId, row: 0 },
      stage: 0,
      structureType: "Village",
    });

    subject.structureModels.set("Village", [model]);
    subject.hasCosmeticSkin = vi.fn(() => false);

    subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
      entering: [structure(1), structure(2)],
      leaving: [],
      staying: [],
      visibleIds: [1, 2],
    });

    const stayingBinding = subject.structureInstanceBindings.get(2)[0];
    expect(setMatrixAt).toHaveBeenCalledTimes(2);
    expect(removeInstance).not.toHaveBeenCalled();
    expect(subject.structureInstanceSlots.get(model)).toEqual([1, 2]);

    setMatrixAt.mockClear();
    setCount.mockClear();
    subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
      entering: [structure(3)],
      leaving: [1],
      staying: [2],
      visibleIds: [2, 3],
    });

    expect(removeInstance).toHaveBeenCalledTimes(1);
    expect(removeInstance).toHaveBeenCalledWith(0);
    expect(setMatrixAt).toHaveBeenCalledTimes(1);
    expect(subject.structureInstanceBindings.get(2)[0]).toBe(stayingBinding);
    expect(subject.structureInstanceSlots.get(model)).toEqual([3, 2]);
    expect(setCount).not.toHaveBeenCalled();

    removeInstance.mockClear();
    setMatrixAt.mockClear();
    subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
      entering: [structure(2), structure(3)],
      leaving: [2, 3],
      staying: [],
      visibleIds: [2, 3],
    });

    expect(removeInstance).toHaveBeenCalledTimes(2);
    expect(setMatrixAt).toHaveBeenCalledTimes(2);

    const staleSnapshot = subject.captureVisibleStructurePassSnapshot();
    visibleStructurePassFence.invalidate();
    removeInstance.mockClear();
    setMatrixAt.mockClear();
    subject.commitVisibleStructureDiff(staleSnapshot, {
      entering: [structure(4)],
      leaving: [3],
      staying: [2],
      visibleIds: [2, 4],
    });

    expect(removeInstance).not.toHaveBeenCalled();
    expect(setMatrixAt).not.toHaveBeenCalled();
    expect([...subject.structureInstanceBindings.keys()].toSorted()).toEqual([2, 3]);
  });

  it("clears an instanced model bucket after its last visible structure leaves", () => {
    const { subject } = createVisibleStructurePassSubject();
    const model = {
      removeInstance: vi.fn(),
      setCount: vi.fn(),
      setMatrixAt: vi.fn(),
    };
    const visibleStructure = {
      entityId: 1,
      hasWonder: false,
      hexCoords: { col: 1, row: 0 },
      stage: 0,
      structureType: "Village",
    };

    subject.structureModels.set("Village", [model]);
    subject.hasCosmeticSkin = vi.fn(() => false);

    subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
      entering: [visibleStructure],
      leaving: [],
      staying: [],
      visibleIds: [1],
    });
    model.setCount.mockClear();

    subject.commitVisibleStructureDiff(subject.captureVisibleStructurePassSnapshot(), {
      entering: [],
      leaving: [1],
      staying: [],
      visibleIds: [],
    });

    expect(model.removeInstance).toHaveBeenCalledWith(0);
    expect(model.setCount).toHaveBeenCalledWith(0);
    expect(subject.structureInstanceSlots.has(model)).toBe(false);
    expect(subject.structureModelDrawCounts.has(model)).toBe(false);
  });

  it.each([0, 3])("ignores an invalid free-slot hint at index %s without scanning the slot array", (freeSlot) => {
    const subject = Object.create(StructureManager.prototype) as any;
    const model = {};
    const slots = [1, 2];

    subject.structureInstanceFreeSlots = new Map([[model, freeSlot]]);

    expect(subject.takeFreeStructureInstanceSlot(model, slots)).toBe(2);
    expect(subject.structureInstanceFreeSlots.has(model)).toBe(false);
  });

  it("resolves a committed targeted refresh while a sustained follow-up burst is still pending", async () => {
    const { subject } = createVisibleStructurePassSubject();
    const preloadReleases: Array<() => void> = [];
    const model = {
      removeInstance: vi.fn(),
      setCount: vi.fn(),
      setMatrixAt: vi.fn(),
    };
    const visibleStructure = {
      entityId: 7,
      hasWonder: false,
      hexCoords: { col: 0, row: 0 },
      stage: 0,
      structureType: "Village",
    };

    subject.structureModels.set("Village", [model]);
    subject.hasCosmeticSkin = vi.fn(() => false);
    subject.getModelForStructure = vi.fn(() => model);
    subject.resolveVisibleStructuresForChunk = vi.fn(() => [visibleStructure]);
    subject.preloadStructureModels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          preloadReleases.push(resolve);
        }),
    );
    subject.finalizeVisibleStructurePass = vi.fn((visibleIds: Set<number>) => {
      subject.previousVisibleIds = new Set(visibleIds);
    });
    initializePendingVisibleStructureRefresh(subject);

    const firstRequest = subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] });
    await vi.waitFor(() => expect(preloadReleases).toHaveLength(1));
    const burstRequests = Array.from({ length: 100 }, () =>
      subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] }),
    );

    preloadReleases.shift()?.();
    await expect(firstRequest).resolves.toBeUndefined();
    await vi.waitFor(() => expect(preloadReleases).toHaveLength(1));

    expect(subject.structureInstanceBindings.has(7)).toBe(true);
    expect(model.setMatrixAt).toHaveBeenCalledTimes(1);

    preloadReleases.shift()?.();
    await Promise.all(burstRequests);
  });

  it("re-queues targeted deltas after a non-committing pass", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const passOptions: Array<{ refreshEntityIds: Set<number> }> = [];

    subject.isDestroyed = false;
    subject.currentChunk = "24,24";
    subject.performVisibleStructuresUpdate = vi.fn(async (options) => {
      passOptions.push({ ...options, refreshEntityIds: new Set(options.refreshEntityIds) });
      return passOptions.length > 1;
    });
    initializePendingVisibleStructureRefresh(subject);

    const firstRequest = subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] });
    await vi.waitFor(() => expect(subject.pendingVisibleStructureRefreshIds).toEqual(new Set([7])));
    const retryRequest = subject.requestVisibleStructuresRefresh({ refreshEntityIds: [8] });

    await Promise.all([firstRequest, retryRequest]);
    expect(passOptions.map((options) => options.refreshEntityIds)).toEqual([new Set([7]), new Set([7, 8])]);
  });

  it("records deltas received while chunk authority is uncommitted", async () => {
    const subject = Object.create(StructureManager.prototype) as any;

    subject.isDestroyed = false;
    subject.currentChunk = "uncommitted";
    subject.pendingVisibleStructureWorkLane = "visible";
    subject.shouldRefreshExistingStructures = false;
    subject.pendingVisibleStructureRefreshIds = new Set();
    subject.pendingVisibleStructureTransitionToken = undefined;
    subject.runVisibleStructuresUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(isCommittedManagerChunk).mockImplementation((chunkKey) => chunkKey !== "uncommitted");

    await subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] });
    expect(subject.runVisibleStructuresUpdate).not.toHaveBeenCalled();
    expect(subject.pendingVisibleStructureRefreshIds).toEqual(new Set([7]));

    subject.currentChunk = "24,24";
    await subject.requestVisibleStructuresRefresh({ refreshEntityIds: [8] });
    expect(subject.runVisibleStructuresUpdate).toHaveBeenCalledOnce();
    expect(subject.pendingVisibleStructureRefreshIds).toEqual(new Set([7, 8]));
  });

  it("upgrades a partially failed delta to a full refresh before retrying", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const passOptions: Array<{ refreshEntityIds: Set<number>; refreshExisting?: boolean }> = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    subject.isDestroyed = false;
    subject.currentChunk = "24,24";
    subject.performVisibleStructuresUpdate = vi
      .fn()
      .mockImplementationOnce(async (options) => {
        passOptions.push({ ...options, refreshEntityIds: new Set(options.refreshEntityIds) });
        throw new Error("partial commit");
      })
      .mockImplementationOnce(async (options) => {
        passOptions.push({ ...options, refreshEntityIds: new Set(options.refreshEntityIds) });
        return true;
      });
    initializePendingVisibleStructureRefresh(subject);

    await subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] });
    expect(subject.shouldRefreshExistingStructures).toBe(true);

    await subject.requestVisibleStructuresRefresh({ refreshEntityIds: [8] });
    expect(passOptions[1]).toMatchObject({
      refreshEntityIds: new Set([7, 8]),
      refreshExisting: true,
    });
    expect(errorSpy).toHaveBeenCalledWith("Failed to update visible structures", expect.any(Error));
  });

  it("queues targeted refreshes without invalidating the in-flight pass", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const visibleStructurePassFence = createVisibleStructurePassFence();
    const inFlightSnapshot = visibleStructurePassFence.capture();
    const runVisibleStructuresUpdate = vi.fn().mockResolvedValue(undefined);

    subject.isDestroyed = false;
    subject.currentChunk = "24,24";
    subject.pendingVisibleStructureWorkLane = "visible";
    subject.shouldRefreshExistingStructures = false;
    subject.pendingVisibleStructureRefreshIds = new Set();
    subject.visibleStructurePassFence = visibleStructurePassFence;
    subject.runVisibleStructuresUpdate = runVisibleStructuresUpdate;

    expect(typeof subject.requestVisibleStructuresRefresh).toBe("function");

    if (typeof subject.requestVisibleStructuresRefresh !== "function") {
      return;
    }

    await subject.requestVisibleStructuresRefresh({ refreshEntityIds: [7] });

    expect(visibleStructurePassFence.invalidate).not.toHaveBeenCalled();
    expect(visibleStructurePassFence.isCurrent(inFlightSnapshot)).toBe(true);
    expect(subject.pendingVisibleStructureRefreshIds).toEqual(new Set([7]));
    expect(runVisibleStructuresUpdate).toHaveBeenCalledTimes(1);
  });
});
