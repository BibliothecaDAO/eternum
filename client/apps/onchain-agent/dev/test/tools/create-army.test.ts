import { describe, it, expect, vi } from "vitest";
import { createCreateArmyTool } from "../../../src/tools/create-army.js";
import type { MapContext } from "../../../src/map/context.js";
import type { MapSnapshot } from "../../../src/map/renderer.js";
import type { TxContext } from "../../../src/tools/tx-context.js";
import type { TileState, EternumClient, StructureInfo } from "@bibliothecadao/client";

// ── Helpers ──────────────────────────────────────────────────────────

const PLAYER = "0xPLAYER";

function makeTile(x: number, y: number, occupierType = 0, occupierId = 0, biome = 11): TileState {
  return {
    position: { x, y },
    biome,
    occupierId,
    occupierType,
    occupierIsStructure: occupierType >= 1 && occupierType <= 14,
    rewardExtracted: false,
  };
}

function makeSnapshot(tiles: TileState[]): MapSnapshot {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  const grid = new Map<string, TileState>();

  for (const t of tiles) {
    if (t.position.x < minX) minX = t.position.x;
    if (t.position.x > maxX) maxX = t.position.x;
    if (t.position.y < minY) minY = t.position.y;
    if (t.position.y > maxY) maxY = t.position.y;
    grid.set(`${t.position.x},${t.position.y}`, t);
  }

  const totalRows = maxY - minY + 1;
  const totalCols = maxX - minX + 1;

  const anchor = { minX, minY, maxX, maxY };
  return {
    text: "(test snapshot)",
    headerLines: 0,
    rowCount: totalRows,
    colCount: totalCols,
    tiles,
    gridIndex: grid,
    resolve(mapRow: number, col: number) {
      if (mapRow < 1 || mapRow > totalRows || col < 1 || col > totalCols) return null;
      const y = maxY - (mapRow - 1);
      const x = minX + (col - 1);
      return { x, y };
    },
    tileAt(mapRow: number, col: number) {
      const pos = this.resolve(mapRow, col);
      if (!pos) return null;
      return grid.get(`${pos.x},${pos.y}`) ?? null;
    },
    explorerDetails: new Map(),
    structureDetails: new Map(),
    anchor,
  };
}

function makeStructure(
  x: number,
  y: number,
  resources: StructureInfo["resources"] = [],
  opts: {
    explorerCount?: number;
    maxExplorerCount?: number;
    ownerAddress?: string;
    category?: string;
  } = {},
): StructureInfo {
  return {
    entityId: 100,
    category: opts.category ?? "Realm",
    level: 1,
    realmId: 1,
    ownerAddress: opts.ownerAddress ?? PLAYER,
    position: { x, y },
    guards: [],
    resources,
    explorerCount: opts.explorerCount ?? 0,
    maxExplorerCount: opts.maxExplorerCount ?? 3,
  };
}

function makeClient(structure: StructureInfo | null = null): EternumClient {
  return {
    view: {
      structureAt: vi.fn().mockResolvedValue(structure),
      explorerInfo: vi.fn().mockResolvedValue(null),
    },
  } as unknown as EternumClient;
}

function makeTxCtx(): TxContext {
  return {
    provider: {
      explorer_create: vi.fn().mockResolvedValue({}),
    },
    signer: {},
  } as unknown as TxContext;
}

/** Realm at (5,5) with open hex at (6,5). Row 1, col 1 = (5,5). */
function realmSetup(biome = 11) {
  const tiles = [makeTile(5, 5, 1, 100, biome), makeTile(6, 5, 0, 0, biome)];
  return { tiles, snapshot: makeSnapshot(tiles) };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("create_army — prerequisites", () => {
  it("fails when no map is loaded", async () => {
    const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("Map not loaded");
  });

  it("fails when structure_id not found on the map", async () => {
    const { snapshot } = realmSetup();
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 999 })).rejects.toThrow("Structure 999 not found");
  });

  it("throws when no structure returned by client", async () => {
    const { snapshot } = realmSetup();
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(null), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("Structure 100 not found");
  });

  it("throws when structure is not a realm", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [], { category: "Village" });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("not a realm");
  });

  it("throws when realm is not owned by player", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [], { ownerAddress: "0xENEMY" });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("not yours");
  });
});

describe("create_army — army cap", () => {
  it("throws when army cap is reached", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 1500 }], {
      explorerCount: 3,
      maxExplorerCount: 3,
    });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("Army cap reached");
  });

  it("allows creation when under cap", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 1500 }], {
      explorerCount: 1,
      maxExplorerCount: 3,
    });
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("Army created");
    expect((result.content[0] as any).text).toContain("2/3");
  });
});

describe("create_army — troop type from biome", () => {
  it("picks Paladin on Grassland", async () => {
    const { snapshot } = realmSetup(11);
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("Paladin");
    expect((result.content[0] as any).text).toContain("+30% on Grassland");
  });

  it("picks Knight in Forest", async () => {
    const { snapshot } = realmSetup(12);
    const structure = makeStructure(5, 5, [{ name: "Knight T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("Knight");
  });

  it("picks Crossbowman on Ocean", async () => {
    const { snapshot } = realmSetup(2);
    const structure = makeStructure(5, 5, [{ name: "Crossbowman T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("Crossbowman");
  });

  it("defaults to Knight for unknown biome", async () => {
    const { snapshot } = realmSetup(99);
    const structure = makeStructure(5, 5, [{ name: "Knight T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("Knight");
  });
});

describe("create_army — spawn direction", () => {
  it("finds an open adjacent hex", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).not.toContain("No open hex");
    expect(result.details).toHaveProperty("spawnDirection");
  });

  it("throws when all adjacent hexes are blocked", async () => {
    // All 6 neighbors occupied — realm at (5,5) on even row
    const tiles = [
      makeTile(5, 5, 1, 100, 11),
      makeTile(6, 5, 15, 10, 11),
      makeTile(6, 6, 15, 11, 11),
      makeTile(5, 6, 15, 12, 11),
      makeTile(4, 5, 15, 13, 11),
      makeTile(5, 4, 15, 14, 11),
      makeTile(6, 4, 15, 15, 11),
    ];
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 1500 }]);
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("No open hex");
  });
});

describe("create_army — resources", () => {
  it("shows available resources in the plan", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [
      { name: "Paladin T1", amount: 5000 },
      { name: "Stone", amount: 1200 },
    ]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });
    expect((result.content[0] as any).text).toContain("5,000 Paladin T1");
  });

  it("throws when realm has no resources", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, []);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    await expect(tool.execute("id", { structure_id: 100 })).rejects.toThrow("No Paladin T1 troops available");
  });
});

describe("create_army — output", () => {
  it("returns plan with all parameters", async () => {
    const { snapshot } = realmSetup();
    const structure = makeStructure(5, 5, [{ name: "Paladin T1", amount: 5000 }]);
    const mapCtx: MapContext = { snapshot, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(structure), mapCtx, PLAYER, makeTxCtx());

    const result = await tool.execute("id", { structure_id: 100 });

    expect(result.details).toMatchObject({
      realmEntityId: 100,
      troopType: "Paladin",
      troopTier: "T1",
      spawnDirection: expect.any(Number),
    });

    const text = (result.content[0] as any).text;
    expect(text).toContain("Paladin T1");
  });

  it("takes structure_id parameter", () => {
    const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
    const tool = createCreateArmyTool(makeClient(), mapCtx, PLAYER, makeTxCtx());

    expect(tool.parameters).toBeDefined();
    expect(tool.parameters.properties).toHaveProperty("structure_id");
  });
});
