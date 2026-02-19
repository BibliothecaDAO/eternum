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

function createStructureManagerSubject() {
  const subject = Object.create(StructureManager.prototype) as any;

  const unsubscribeFrustum = vi.fn();
  const unsubscribeAccountStore = vi.fn();
  const unsubscribeVisibility = vi.fn();
  const removeCameraViewListener = vi.fn();
  const clearAttachmentManager = vi.fn();
  const releaseLabel = vi.fn();
  const clearLabelPool = vi.fn();
  const labelA = { id: "a" };
  const labelB = { id: "b" };
  const removeLabelFromGroup = vi.fn();
  const disposePointsA = vi.fn();
  const disposePointsB = vi.fn();
  const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

  const structureModelDispose = vi.fn();
  const structureModelParentRemove = vi.fn();
  const cosmeticModelDispose = vi.fn();
  const cosmeticModelParentRemove = vi.fn();

  const structuresMap = new Map([[1, new Map()]]);

  subject.unsubscribeFrustum = unsubscribeFrustum;
  subject.unsubscribeAccountStore = unsubscribeAccountStore;
  subject.unsubscribeVisibility = unsubscribeVisibility;
  subject.hexagonScene = { removeCameraViewListener };
  subject.handleCameraViewChange = vi.fn();
  subject.battleTimerInterval = setInterval(() => {}, 60_000);
  subject.pendingLabelUpdates = new Map([[1, { pending: true }]]);
  subject.entityIdLabels = new Map([
    [1, labelA],
    [2, labelB],
  ]);
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
  subject.structures = {
    getStructures: () => structuresMap,
  };
  subject.structureHexCoords = new Map([[1, new Set([1])]]);
  subject.chunkToStructures = new Map([["0,0", new Set([1])]]);
  subject.structuresWithActiveBattleTimer = new Set([1]);
  subject.previousVisibleIds = new Set([1]);
  subject.pointsRenderers = {
    a: { dispose: disposePointsA },
    b: { dispose: disposePointsB },
  };

  return {
    subject,
    unsubscribeFrustum,
    unsubscribeAccountStore,
    unsubscribeVisibility,
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
    clearIntervalSpy,
  };
}

function createOnUpdateSubject() {
  const subject = Object.create(StructureManager.prototype) as any;
  const structuresById = new Map<number, any>();

  subject.ensureStructureModels = vi.fn().mockResolvedValue([]);
  subject.dummy = {
    position: { copy: vi.fn() },
    updateMatrix: vi.fn(),
  };
  subject.structureHexCoords = new Map();
  subject.updateSpatialIndex = vi.fn();
  subject.pendingLabelUpdates = new Map();
  subject.components = undefined;
  subject.entityIdLabels = new Map();
  subject.updateBattleTimerTracking = vi.fn();
  subject.isInCurrentChunk = vi.fn(() => false);
  subject.updateVisibleStructures = vi.fn();
  subject.structures = {
    getStructureByEntityId: vi.fn((entityId: number) => structuresById.get(entityId)),
    addStructure: vi.fn(
      (
        entityId: number,
        structureName: string,
        structureType: unknown,
        hexCoords: { col: number; row: number },
        initialized: boolean,
        stage: number,
        level: number,
        owner: { address: bigint; ownerName: string; guildName: string },
        _hasWonder: boolean,
        _attachments: unknown,
        isAlly: boolean,
        guardArmies: unknown,
        activeProductions: unknown,
      ) => {
        structuresById.set(entityId, {
          entityId,
          structureName,
          structureType,
          hexCoords,
          initialized,
          stage,
          level,
          owner,
          isMine: false,
          isAlly,
          guardArmies,
          activeProductions,
        });
      },
    ),
  };

  return { subject, structuresById };
}

const BASE_STRUCTURE_UPDATE = {
  entityId: 7,
  structureName: "Camp",
  hexCoords: { col: 10, row: 15 },
  structureType: "Village" as any,
  initialized: true,
  stage: 0,
  level: 1,
  hasWonder: false,
  isAlly: false,
  guardArmies: [],
  activeProductions: [],
  battleData: {},
};

describe("StructureManager destroy lifecycle", () => {
  it("cleans subscriptions, timers, labels, models, and caches", () => {
    const fixture = createStructureManagerSubject();

    fixture.subject.destroy();

    expect(fixture.unsubscribeFrustum).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeAccountStore).toHaveBeenCalledTimes(1);
    expect(fixture.unsubscribeVisibility).toHaveBeenCalledTimes(1);
    expect(fixture.removeCameraViewListener).toHaveBeenCalledTimes(1);
    expect(fixture.clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(fixture.subject.battleTimerInterval).toBeNull();
    expect(fixture.subject.pendingLabelUpdates.size).toBe(0);
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
    expect(fixture.subject.structureModels.size).toBe(0);
    expect(fixture.subject.cosmeticStructureModels.size).toBe(0);
    expect(fixture.subject.entityIdMaps.size).toBe(0);
    expect(fixture.subject.cosmeticEntityIdMaps.size).toBe(0);
    expect(fixture.subject.wonderEntityIdMaps.size).toBe(0);
    expect(fixture.subject.structureHexCoords.size).toBe(0);
    expect(fixture.subject.chunkToStructures.size).toBe(0);
    expect(fixture.subject.structuresWithActiveBattleTimer.size).toBe(0);
    expect(fixture.subject.previousVisibleIds.size).toBe(0);
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
    expect(warnSpy).toHaveBeenCalledWith("StructureManager already destroyed, skipping cleanup");
  });

  it("keeps tile owner name when a building-only pending update exists", async () => {
    const { subject, structuresById } = createOnUpdateSubject();

    subject.updateStructureLabelFromBuildingUpdate({
      entityId: 7,
      activeProductions: [{ buildingCount: 2, buildingType: 1 as any }],
    });

    await subject.onUpdate({
      ...BASE_STRUCTURE_UPDATE,
      owner: { address: 0n, ownerName: "The Vanguard", guildName: "" },
    });

    const updated = structuresById.get(7);
    expect(updated.owner.ownerName).toBe("The Vanguard");
  });

  it("keeps tile owner address when a building-only pending update exists", async () => {
    const { subject, structuresById } = createOnUpdateSubject();

    subject.updateStructureLabelFromBuildingUpdate({
      entityId: 7,
      activeProductions: [{ buildingCount: 2, buildingType: 1 as any }],
    });

    await subject.onUpdate({
      ...BASE_STRUCTURE_UPDATE,
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
    });

    const updated = structuresById.get(7);
    expect(updated.owner.address).toBe(123n);
    expect(updated.owner.ownerName).toBe("Alice");
  });

  it("applies pending structure owner updates even when owner becomes unowned", async () => {
    const { subject, structuresById } = createOnUpdateSubject();

    subject.updateStructureLabelFromStructureUpdate({
      entityId: 7,
      guardArmies: [],
      owner: { address: 0n, ownerName: "The Vanguard", guildName: "" },
      battleCooldownEnd: 0,
    });

    await subject.onUpdate({
      ...BASE_STRUCTURE_UPDATE,
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
    });

    const updated = structuresById.get(7);
    expect(updated.owner.address).toBe(0n);
    expect(updated.owner.ownerName).toBe("The Vanguard");
  });
});
