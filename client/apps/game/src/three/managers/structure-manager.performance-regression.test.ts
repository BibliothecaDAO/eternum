import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
    spawnAttachments() {}
    updateAttachmentTransforms() {}
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
    acquire(factory: () => unknown) {
      return { label: factory() };
    }
    flushBatch() {}
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

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager performance regressions", () => {
  it("indexes structures directly by entity id", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/private\s+structuresById:\s*Map<ID,\s*StructureInfo>\s*=\s*new Map\(\)/);
    expect(source).toMatch(/getStructureByEntityId[\s\S]*return\s+this\.structuresById\.get\(normalizedEntityId\)/);
    expect(source).not.toMatch(/getStructureByEntityId[\s\S]*for\s*\(\s*const\s+structures\s+of\s+this\.structures\.values\(\)\s*\)/);
  });

  it("shares structure render preparation across base and cosmetic model paths", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/private\s+prepareVisibleStructureRenderState\s*\(/);
    expect(source).toMatch(/prepareVisibleStructureRenderState\(structure,\s*structureType,\s*this\.entityIdLabels\.get/);
    expect(source).not.toMatch(/for\s*\(const\s+\[cosmeticId,\s*structures\]\s+of\s+structuresByCosmeticId\)[\s\S]*const\s+rotationSeed\s*=\s*hashCoordinates/);
  });

  it("dedupes label dirtiness subscriptions when visibility manager is active", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/if\s*\(this\.frustumManager\s*&&\s*!this\.visibilityManager\)\s*\{/);
  });

  it("passes visibility manager through to points renderers", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/new\s+PointsLabelRenderer\([\s\S]*this\.frustumManager,\s*this\.visibilityManager[\s\S]*\)/);
  });

  it("reconciles visible structures once during a chunk update", async () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const updateVisibleStructures = vi.fn(async () => {});

    subject.currentChunk = "0,0";
    subject.chunkSwitchPromise = null;
    subject.latestTransitionToken = 0;
    subject.transitionChunkByToken = new Map();
    subject.pruneTransitionChunkHistory = vi.fn();
    subject.updateVisibleStructures = updateVisibleStructures;

    await subject.updateChunk("1,1");

    expect(updateVisibleStructures).toHaveBeenCalledTimes(1);
  });

  it("keeps showLabels label-only without retriggering visible reconciliation", () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const updateVisibleStructures = vi.fn();

    subject.updateVisibleStructures = updateVisibleStructures;
    subject.currentChunk = "0,0";
    subject.getVisibleStructuresForChunk = vi.fn(() => []);

    subject.showLabels();

    expect(updateVisibleStructures).not.toHaveBeenCalled();
  });

  it("does not create hover labels during bulk showLabels calls", () => {
    const subject = Object.create(StructureManager.prototype) as any;
    const addEntityIdLabel = vi.fn();

    subject.currentChunk = "0,0";
    subject.entityIdLabels = new Map();
    subject.scratchPosition = { y: 0 };
    subject.scratchLabelPosition = {
      copy: vi.fn(() => subject.scratchLabelPosition),
      y: 0,
    };
    subject.getVisibleStructuresForChunk = vi.fn(() => [
      {
        entityId: 1,
        hexCoords: { col: 4, row: 6 },
      },
    ]);
    subject.addEntityIdLabel = addEntityIdLabel;

    subject.showLabels();

    expect(addEntityIdLabel).not.toHaveBeenCalled();
  });

  it("moves visible ownership-bucket point icons without a full visible rebuild", () => {
    const myRealmRemovePoint = vi.fn();
    const enemyRealmSetPoint = vi.fn();
    const updateVisibleStructures = vi.fn();
    const updateBattleTimerTracking = vi.fn();
    const structure = {
      entityId: 1,
      structureType: "Realm",
      hexCoords: { col: 4, row: 6 },
      isMine: true,
      isAlly: false,
      owner: { address: 1n, ownerName: "old", guildName: "" },
      guardArmies: [],
      battleCooldownEnd: 0,
      battleTimerLeft: 0,
    };
    const subject = Object.create(StructureManager.prototype) as any;

    subject.pendingLabelUpdates = new Map();
    subject.structures = {
      getStructureByEntityId: vi.fn(() => structure),
      updateStructure: vi.fn(),
    };
    subject.entityIdLabels = new Map();
    subject.fxManager = { playTroopDiffFx: vi.fn() };
    subject.updateBattleTimerTracking = updateBattleTimerTracking;
    subject.updateVisibleStructures = updateVisibleStructures;
    subject.previousVisibleIds = new Set([1]);
    subject.pointsRenderers = {
      myRealm: { removePoint: myRealmRemovePoint },
      enemyRealm: { setPoint: enemyRealmSetPoint },
      allyRealm: { removePoint: vi.fn(), setPoint: vi.fn() },
      myVillage: { removePoint: vi.fn(), setPoint: vi.fn() },
      enemyVillage: { removePoint: vi.fn(), setPoint: vi.fn() },
      allyVillage: { removePoint: vi.fn(), setPoint: vi.fn() },
      hyperstructure: { removePoint: vi.fn(), setPoint: vi.fn() },
      bank: { removePoint: vi.fn(), setPoint: vi.fn() },
      fragmentMine: { removePoint: vi.fn(), setPoint: vi.fn() },
    };
    subject.scratchIconPosition = {
      copy: vi.fn(() => subject.scratchIconPosition),
      y: 0,
    };

    subject.updateStructureLabelFromStructureUpdate({
      entityId: 1,
      guardArmies: [],
      owner: { address: 999n, ownerName: "new", guildName: "" },
      battleCooldownEnd: 12,
    });

    expect(updateVisibleStructures).not.toHaveBeenCalled();
    expect(updateBattleTimerTracking).toHaveBeenCalledWith(1, 12);
    expect(myRealmRemovePoint).toHaveBeenCalledWith(1);
    expect(enemyRealmSetPoint).toHaveBeenCalledTimes(1);
  });
});
