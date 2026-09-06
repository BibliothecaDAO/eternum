// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { BiomeType, StructureType, TileOccupier, defineContractComponents } from "@bibliothecadao/types";
import { createWorld, getComponentValue } from "@dojoengine/recs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRecsGameSyncStore } from "@/sync/recs-game-sync-store";
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

interface FixtureEntity {
  models: Record<string, Record<string, unknown>>;
}

interface StructureComponentValue {
  base: { category: number; level: number };
  entity_id: number;
  owner: bigint;
}

const structureTemplate = (
  JSON.parse(readFileSync(resolve(process.cwd(), "src/sync/recs-game-sync-store.parity.json"), "utf8")) as {
    entities: FixtureEntity[];
  }
).entities.find((entity) => "Structure" in entity.models)!.models.Structure;

describe("worldmap terrain ecology refresh", () => {
  afterEach(() => vi.restoreAllMocks());

  it("presents current RECS owner/category/level and projection placement/removal with a fixed window", async () => {
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
    await harness.writeTile("reserved", 2, 0, 3, TileOccupier.HyperstructureLevel1);
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

  it("coalesces a component batch, refreshes cross-page roads, and commits the newest overlapping facts", async () => {
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
  const world = createWorld();
  const components = defineContractComponents(world, "s2");
  const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, [
    "Structure",
    "TileOpt",
  ]);
  const projection = new WorldSpatialProjection({
    explorerTroopsComponent: components.ExplorerTroops,
    tileOptComponent: components.TileOpt,
  });
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
    const { roadAnchors, settlementAnchors } = collectCurrentAnchors(cells, projection, components.Structure);
    return {
      cells: cells.map((cell) => ({
        ...cell,
        occupied: projection.getStructuresAtHex(cell).some((structure) => !structure.reserved),
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
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: structureEntityKey(entityId),
            models: { Structure: structureModel(entityId, owner, category, level) },
          },
        ],
      },
    ]);
  const writeTile = (tileId: string, col: number, row: number, entityId: number, occupierType: TileOccupier) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: tileEntityKey(tileId),
            models: { TileOpt: tileModel(col, row, entityId, occupierType) },
          },
        ],
      },
    ]);

  return {
    bindEcologyRefresh: () =>
      bindWorldmapTerrainEcologyRefresh({
        projection,
        requestRefresh,
        structureComponent: components.Structure,
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
      await store.applyEntityOperations([
        { type: "remove-components", entityId: structureEntityKey(entityId), models: ["Structure"] },
        { type: "remove-components", entityId: tileEntityKey(tileId), models: ["TileOpt"] },
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
  structureComponent: ReturnType<typeof defineContractComponents>["Structure"],
): ReturnType<typeof collectWorldmapTerrainEcologyAnchors> {
  const componentsByEntityId = new Map<number, StructureComponentValue>();
  for (const entity of structureComponent.entities()) {
    const component = getComponentValue(structureComponent, entity) as StructureComponentValue | undefined;
    if (component) componentsByEntityId.set(component.entity_id, component);
  }
  return collectWorldmapTerrainEcologyAnchors({
    cells,
    getStructureFacts: (entityId) => {
      const component = componentsByEntityId.get(entityId);
      return component
        ? {
            base: {
              category: component.base.category as StructureType,
              level: component.base.level,
            },
            entity_id: component.entity_id,
            owner: component.owner,
          }
        : undefined;
    },
    normalizeStructureHex: ({ col, row }) => ({ col, row }),
    projection,
    toProjectionBounds: (bounds) => bounds,
  });
}

function structureModel(entityId: number, owner: bigint, category: StructureType, level: number) {
  return {
    ...structureTemplate,
    base: {
      ...(structureTemplate.base as Record<string, unknown>),
      category,
      level,
    },
    entity_id: entityId,
    owner: `0x${owner.toString(16)}`,
  };
}

function tileModel(col: number, row: number, entityId: number, occupierType: TileOccupier) {
  return {
    alt: false,
    col,
    data: `0x${encodeTile(col, row, entityId, occupierType).toString(16)}`,
    game_id: "0xb",
    row,
  };
}

function encodeTile(col: number, row: number, entityId: number, occupierType: TileOccupier): bigint {
  const grasslandBiome = 4n;
  return (
    (BigInt(col) << 81n) |
    (BigInt(row) << 49n) |
    (grasslandBiome << 41n) |
    (BigInt(entityId) << 9n) |
    (BigInt(occupierType) << 1n) |
    1n
  );
}

function structureEntityKey(entityId: number): string {
  return `structure-${entityId}`;
}

function tileEntityKey(tileId: string): string {
  return `tile-${tileId}`;
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
