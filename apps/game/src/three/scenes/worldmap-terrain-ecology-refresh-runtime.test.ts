// @vitest-environment node

import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { BiomeType, StructureType, TileOccupier } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FrameBudgetWorkQueue } from "@/three/frame-budget-work-queue";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { prepareTerrainPage } from "@/three/terrain/terrain-page-builder";
import {
  WorldmapProceduralTerrain,
  buildWorldmapTerrainPageRequests,
  type WorldmapProceduralPresentationDiagnostics,
  type WorldmapProceduralPresentationInput,
} from "@/three/terrain/worldmap-procedural-terrain";
import {
  bindWorldmapTerrainEcologyRefresh,
  collectWorldmapTerrainEcologyAnchors,
} from "./worldmap-terrain-ecology-refresh-runtime";

describe("worldmap terrain ecology refresh", () => {
  afterEach(() => vi.restoreAllMocks());

  it("presents current native owner/category/level and projection placement/removal with a fixed window", async () => {
    stubTerrainWorker();
    const harness = createHarness();
    await harness.seedStructure(1, 0, 1n, StructureType.Realm, 1);
    await harness.seedStructure(2, 3, 1n, StructureType.Realm, 1);
    harness.projection.start();
    await harness.presentInitialTerrain();
    const unsubscribe = harness.bindEcologyRefresh();

    await harness.writeStructure(2, 1n, StructureType.Realm, 4);
    await harness.waitForPresentation(1);

    expect(harness.latestAnchors().settlementAnchors).toContainEqual(
      expect.objectContaining({ level: 4, structureId: "2", structureType: StructureType.Realm }),
    );
    expect(harness.latestDiagnostics()).toMatchObject({ builtPages: 2, reusedPages: 1 });

    await harness.writeStructure(2, 2n, StructureType.Realm, 4);
    await harness.waitForPresentation(2);

    expect(harness.latestAnchors().roadAnchors).toEqual([
      expect.objectContaining({ owner: "1", structureId: "1" }),
      expect.objectContaining({ owner: "2", structureId: "2" }),
    ]);
    expect(harness.latestDiagnostics()).toMatchObject({ builtPages: 2, reusedPages: 1 });

    await harness.writeStructure(2, 2n, StructureType.Village, 4);
    await harness.waitForPresentation(3);

    expect(harness.latestAnchors().settlementAnchors).toContainEqual(
      expect.objectContaining({ level: 4, structureId: "2", structureType: StructureType.Village }),
    );
    expect(harness.latestDiagnostics()).toMatchObject({ builtPages: 2, reusedPages: 1 });

    await harness.writeTile("reserved", 2, 0, 0, TileOccupier.ReservedHyperstructure);
    harness.projection.flush();
    await harness.waitForPresentation(4);
    expect(harness.latestAnchors().settlementAnchors.map(({ structureId }) => structureId)).toEqual(["1", "2"]);

    await harness.writeStructure(3, 3n, StructureType.Hyperstructure, 1);
    await harness.writeTile("reserved", 2, 0, 3, TileOccupier.Hyperstructure);
    harness.projection.flush();
    await harness.waitForPresentation(5);
    expect(harness.latestAnchors().settlementAnchors).toContainEqual(
      expect.objectContaining({ level: 1, structureId: "3", structureType: StructureType.Hyperstructure }),
    );

    await harness.removeStructureAndTile(3, "reserved");
    await harness.waitForPresentation(6);
    expect(harness.latestAnchors().settlementAnchors.map(({ structureId }) => structureId)).toEqual(["1", "2"]);

    unsubscribe();
    harness.dispose();
  });

  it("coalesces a fact batch, refreshes cross-page roads, and commits the newest overlapping facts", async () => {
    stubTerrainWorker();
    const harness = createHarness();
    await harness.seedStructure(1, 0, 1n, StructureType.Realm, 1);
    await harness.seedStructure(2, 3, 1n, StructureType.Realm, 1);
    harness.projection.start();
    await harness.presentInitialTerrain();
    const unsubscribe = harness.bindEcologyRefresh();

    await Promise.all([
      harness.writeStructure(2, 2n, StructureType.Realm, 2),
      harness.writeStructure(2, 3n, StructureType.Village, 4),
    ]);
    await harness.waitForPresentation(1);

    expect(harness.presentationCount()).toBe(1);
    expect(harness.latestAnchors()).toMatchObject({
      roadAnchors: [
        { owner: "1", structureId: "1" },
        { owner: "3", structureId: "2" },
      ],
      settlementAnchors: [
        { level: 1, structureId: "1", structureType: StructureType.Realm },
        { level: 4, structureId: "2", structureType: StructureType.Village },
      ],
    });
    expect(harness.latestDiagnostics()).toMatchObject({ builtPages: 2, reusedPages: 1 });
    expect(harness.latestRequests().find(({ pageKey }) => pageKey === "0,18")?.roadSegments).toEqual([]);

    unsubscribe();
    const presentationsBeforeDispose = harness.presentationCount();
    await harness.writeStructure(2, 4n, StructureType.Realm, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.presentationCount()).toBe(presentationsBeforeDispose);
    harness.dispose();
  });
});

function createHarness() {
  configManager.setActiveGame(11, 1);
  const store = new NativeFactStore();
  const tileKeys = new Map<string, string>();
  const projection = new WorldSpatialProjection({ store });
  const terrain = new WorldmapProceduralTerrain();
  const queue = new FrameBudgetWorkQueue({
    requestDrain: (drain) => {
      const timeout = setTimeout(drain, 0);
      return () => clearTimeout(timeout);
    },
  });
  const cells = [0, 1, 2, 3, 4, 5, 18, 19, 20].map((col) => ({
    biomeKey: BiomeType.Grassland,
    col,
    occupied: false,
    row: 0,
  }));
  const diagnostics: WorldmapProceduralPresentationDiagnostics[] = [];
  const inputs: WorldmapProceduralPresentationInput[] = [];
  let compositeQueued = false;

  const buildCurrentInput = (): WorldmapProceduralPresentationInput => {
    const { roadAnchors, settlementAnchors } = collectCurrentAnchors(cells, projection, store);
    return {
      cells: cells.map((cell) => ({
        ...cell,
        occupied: projection.getStructuresAtHex({ ...cell, alt: false }).some((structure) => !structure.reserved),
      })),
      commitMode: "atomic",
      mapCenter: 0,
      pageHeight: 1,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 3,
      roadAnchors,
      settlementAnchors,
      subdivisions: 1,
    };
  };
  const presentCurrentFacts = (): void => {
    const input = buildCurrentInput();
    inputs.push(input);
    void terrain.presentAsync(input, queue).then((result) => {
      if (result) diagnostics.push(result);
    });
  };
  const requestRefresh = (): void => {
    if (compositeQueued) return;
    compositeQueued = true;
    void queue.schedule(
      "critical",
      () => {
        compositeQueued = false;
        presentCurrentFacts();
      },
      "terrain:composite",
    );
  };
  const writeStructure = (entityId: number, owner: bigint, category: StructureType, level: number) =>
    store.applyFacts([
      {
        model: "Structure",
        key: structureEntityKey(entityId),
        value: structureModel(entityId, owner, category, level),
      },
    ]);
  const writeTile = (tileId: string, col: number, row: number, entityId: number, occupierType: TileOccupier) => {
    const key = hash.computePoseidonHashOnElements([11, 0, col, row]);
    tileKeys.set(tileId, key);
    return store.applyFacts([
      { model: "TileOpt", key, value: tileModel(col, row) },
      {
        model: "TileOccupancy",
        key,
        value: {
          game_id: 11,
          alt: false,
          col,
          row,
          entity_id: entityId,
          category: occupierType,
          is_structure: true,
        },
      },
    ]);
  };

  return {
    bindEcologyRefresh: () =>
      bindWorldmapTerrainEcologyRefresh({
        projection,
        requestRefresh,
        store,
      }),
    dispose: () => {
      projection.dispose();
      queue.dispose();
      terrain.dispose();
    },
    latestAnchors: () => {
      const input = inputs.at(-1);
      if (!input) throw new Error("No terrain presentation input captured");
      return { roadAnchors: input.roadAnchors ?? [], settlementAnchors: input.settlementAnchors ?? [] };
    },
    latestDiagnostics: () => diagnostics.at(-1),
    latestRequests: () => buildWorldmapTerrainPageRequests(inputs.at(-1)!),
    presentInitialTerrain: async () => terrain.presentAsync(buildCurrentInput()),
    presentationCount: () => inputs.length,
    projection,
    removeStructureAndTile: async (entityId: number, tileId: string) => {
      await store.applyFacts([
        { model: "Structure", key: structureEntityKey(entityId), value: null },
        { model: "TileOpt", key: tileKeys.get(tileId)!, value: null },
        { model: "TileOccupancy", key: tileKeys.get(tileId)!, value: null },
      ]);
      projection.flush();
    },
    seedStructure: async (entityId: number, col: number, owner: bigint, category: StructureType, level: number) => {
      await writeStructure(entityId, owner, category, level);
      await writeTile(String(entityId), col, 0, entityId, TileOccupier.RealmRegularLevel1);
    },
    waitForPresentation: async (count: number) => waitFor(() => diagnostics.length >= count),
    writeStructure,
    writeTile,
  };
}

function collectCurrentAnchors(
  cells: readonly { biomeKey: string; col: number; row: number }[],
  projection: WorldSpatialProjection,
  store: NativeFactStore,
): ReturnType<typeof collectWorldmapTerrainEcologyAnchors> {
  return collectWorldmapTerrainEcologyAnchors({
    cells,
    getStructureFacts: (entityId) => store.get("Structure", { game_id: 11, entity_id: entityId }),
    normalizeStructureHex: ({ col, row }) => ({ col, row }),
    projection,
    toProjectionBounds: (bounds) => ({ ...bounds, alt: false }),
  });
}

function structureModel(entityId: number, owner: bigint, category: StructureType, level: number) {
  return {
    game_id: 11,
    entity_id: entityId,
    owner,
    base: {
      category,
      level,
      created_at: 0,
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      starting_troops_granted: false,
    },
    metadata: {
      realm_id: 0,
      order: 0,
      has_wonder: false,
      village_realm: 0,
      mine_kind: 0,
      attunement: 0,
      barracks_tier: 0,
    },
    resources_packed: "0",
  };
}

function tileModel(col: number, row: number) {
  return {
    alt: false,
    col,
    data: 4n << 41n,
    game_id: "0xb",
    row,
  };
}

function structureEntityKey(entityId: number): string {
  return hash.computePoseidonHashOnElements([11, entityId]);
}

function stubTerrainWorker(): void {
  vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation(async (request) =>
    prepareTerrainPage(request),
  );
  vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Condition was not reached");
}
