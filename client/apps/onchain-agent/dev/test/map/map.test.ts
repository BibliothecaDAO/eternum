import { describe, it, expect, vi } from "vitest";
import type { MapContext } from "../../../src/map/context.js";
import { createInspectTool } from "../../../src/tools/inspect.js";
import { renderMap } from "../../../src/map/renderer.js";
import { ViewClient, type SqlApiLike } from "@bibliothecadao/client";
import { tileDataToTile } from "@bibliothecadao/types";

import tilesRaw from "../fixtures/tiles-raw.json";

const tilesDecoded = tilesRaw.map((row: { data: string }) => tileDataToTile(row.data));

function mockSql(tiles: any[] = []): SqlApiLike {
  return {
    fetchAllTiles: vi.fn().mockResolvedValue(tiles),
    fetchStructureByCoord: vi.fn().mockResolvedValue(null),
    fetchGuardsByStructure: vi.fn().mockResolvedValue([]),
    fetchResourceBalances: vi.fn().mockResolvedValue([]),
    fetchExplorerById: vi.fn().mockResolvedValue(null),
  };
}

function createView(tiles: any[]) {
  const sql = mockSql(tiles);
  return new ViewClient(sql);
}

/** Helper: fetch tiles via ViewClient and render into a MapContext. */
async function loadMap(view: ViewClient, radius = 100): Promise<MapContext> {
  const center = tilesDecoded[0];
  const area = await view.mapArea({ x: center.col, y: center.row, radius });
  const snapshot = renderMap(area.tiles);
  return { snapshot, filePath: null };
}

describe("tileDataToTile — raw hex decoding", () => {
  it("decodes packed hex into tile fields", () => {
    const tile = tileDataToTile(tilesRaw[0].data);
    expect(typeof tile.col).toBe("number");
    expect(typeof tile.row).toBe("number");
    expect(typeof tile.biome).toBe("number");
    expect(typeof tile.occupier_id).toBe("number");
    expect(typeof tile.occupier_type).toBe("number");
    expect(typeof tile.occupier_is_structure).toBe("boolean");
    expect(typeof tile.alt).toBe("boolean");
    expect(typeof tile.reward_extracted).toBe("boolean");
  });

  it("produces correct values for known hex", () => {
    const tile = tileDataToTile("0x0000c842a0c2c842a1001c0000000000");
    expect(tile.col).toBe(1679904865);
    expect(tile.row).toBe(1679904896);
    expect(tile.biome).toBe(14);
    expect(tile.occupier_id).toBe(0);
    expect(tile.occupier_is_structure).toBe(false);
    expect(tile.alt).toBe(false);
  });
});

describe("ViewClient.mapArea — tiles only", () => {
  it("returns all tiles regardless of radius", async () => {
    const view = createView(tilesDecoded);
    const area = await view.mapArea({ x: 0, y: 0, radius: 1 });
    expect(area.tiles.length).toBe(tilesDecoded.length);
  });
});

describe("renderMap — ASCII output", () => {
  it("renders tiles as ASCII with row numbers", async () => {
    const view = createView(tilesDecoded);
    const center = tilesDecoded[0];
    const area = await view.mapArea({ x: center.col, y: center.row, radius: 100 });
    const snapshot = renderMap(area.tiles);

    const lines = snapshot.text.split("\n");
    // Map may have trailing sections (YOUR ENTITIES, POINTS OF INTEREST)
    expect(lines.length).toBeGreaterThanOrEqual(snapshot.headerLines + snapshot.rowCount);

    const firstMapLine = lines[snapshot.headerLines];
    expect(firstMapLine).toMatch(/^\s*1\|/);

    console.log(snapshot.text);
  });

  it("returns empty snapshot for no tiles", () => {
    const snapshot = renderMap([]);
    expect(snapshot.text).toBe("No explored tiles.");
    expect(snapshot.rowCount).toBe(0);
  });
});

describe("renderMap — coordinate resolution", () => {
  it("resolves row:col back to hex coordinates", async () => {
    const view = createView(tilesDecoded);
    const center = tilesDecoded[0];
    const area = await view.mapArea({ x: center.col, y: center.row, radius: 100 });
    const snapshot = renderMap(area.tiles);

    const topLeft = snapshot.resolve(1, 1);
    expect(topLeft).not.toBeNull();

    const bottomRight = snapshot.resolve(snapshot.rowCount, snapshot.colCount);
    expect(bottomRight).not.toBeNull();

    expect(snapshot.resolve(0, 1)).toBeNull();
    expect(snapshot.resolve(1, 0)).toBeNull();
    expect(snapshot.resolve(snapshot.rowCount + 1, 1)).toBeNull();
  });

  it("tileAt returns tile data for explored positions", async () => {
    const view = createView(tilesDecoded);
    const center = tilesDecoded[0];
    const area = await view.mapArea({ x: center.col, y: center.row, radius: 100 });
    const snapshot = renderMap(area.tiles);

    let foundTile = false;
    for (let r = 1; r <= snapshot.rowCount && !foundTile; r++) {
      for (let c = 1; c <= snapshot.colCount && !foundTile; c++) {
        const tile = snapshot.tileAt(r, c);
        if (tile) {
          expect(tile.biome).toBeTypeOf("number");
          expect(tile.occupierType).toBeTypeOf("number");
          foundTile = true;
        }
      }
    }
    expect(foundTile).toBe(true);
  });
});

describe("inspect tool — empty tiles", () => {
  it("returns biome briefing for explored empty tile", async () => {
    const view = createView(tilesDecoded);
    const client = { view } as any;
    const ctx = await loadMap(view);
    const inspectTool = createInspectTool(client, ctx);

    let row = 0,
      col = 0;
    for (let r = 1; r <= ctx.snapshot!.rowCount && row === 0; r++) {
      for (let c = 1; c <= ctx.snapshot!.colCount && row === 0; c++) {
        const tile = ctx.snapshot!.tileAt(r, c);
        if (tile && tile.occupierType === 0) {
          row = r;
          col = c;
        }
      }
    }

    const result = await inspectTool.execute("call-2", { row, col });
    expect(result.content[0].text).toContain("Empty tile");
  });

  it("returns unexplored for positions outside explored area", async () => {
    const view = createView(tilesDecoded);
    const client = { view } as any;
    const ctx = await loadMap(view);
    const inspectTool = createInspectTool(client, ctx);

    let row = 1,
      col = ctx.snapshot!.colCount;
    while (ctx.snapshot!.tileAt(row, col) && col > 1) col--;
    const result = await inspectTool.execute("call-2", { row, col });
    expect(result.content[0].text).toContain("Unexplored");
  });

  it("errors when no map is loaded", async () => {
    const view = createView(tilesDecoded);
    const client = { view } as any;
    const ctx: MapContext = { snapshot: null, filePath: null };
    const inspectTool = createInspectTool(client, ctx);

    await expect(inspectTool.execute("call-1", { row: 1, col: 1 })).rejects.toThrow("Map not loaded");
  });
});

describe("inspect tool — structures", () => {
  it("returns structure briefing with guards and resources", async () => {
    const sql = mockSql(tilesDecoded);

    sql.fetchStructureByCoord = vi.fn().mockResolvedValue({
      entity_id: 42,
      structure_category: 1,
      structure_level: 2,
      realm_id: 7,
      occupier_id: "0x1234",
      coord_x: 100,
      coord_y: 200,
      troop_explorer_count: 1,
      troop_max_explorer_count: 3,
    });
    sql.fetchGuardsByStructure = vi.fn().mockResolvedValue([
      {
        slot: 0,
        troops: { category: "1", tier: "2", count: 2400000000000n, stamina: { amount: 80n, updated_tick: 0n } },
        destroyedTick: 0n,
        cooldownEnd: 0,
      },
    ]);
    sql.fetchResourceBalances = vi.fn().mockResolvedValue([
      {
        entity_id: 42,
        WOOD_BALANCE: "0x00000000000000000000006fc23ac000",
        STONE_BALANCE: "0x000000000000000000000045d964b800",
      },
    ]);

    const view = new ViewClient(sql);
    const client = { view } as any;
    const ctx = await loadMap(view);
    const inspectTool = createInspectTool(client, ctx);

    let row = 0,
      col = 0;
    for (let r = 1; r <= ctx.snapshot!.rowCount && row === 0; r++) {
      for (let c = 1; c <= ctx.snapshot!.colCount && row === 0; c++) {
        const tile = ctx.snapshot!.tileAt(r, c);
        if (tile && tile.occupierType >= 1 && tile.occupierType <= 14) {
          row = r;
          col = c;
        }
      }
    }

    const result = await inspectTool.execute("call-2", { row, col });
    const text = result.content[0].text;
    expect(text).toContain("Realm");
    expect(text).toContain("Guards:");
    // category "1" = Paladin, tier "2" = T3
    expect(text).toContain("Paladin T3");
    expect(text).toContain("Resources:");
  });
});

describe("inspect tool — explorers", () => {
  it("returns explorer briefing with troops and owner", async () => {
    const sql = mockSql(tilesDecoded);

    sql.fetchExplorerById = vi.fn().mockResolvedValue({
      explorer_id: 99,
      owner: 42,
      troop_category: 1,
      troop_tier: 2,
      troop_count: "0x00000000000000000000002e90edd000",
      max_stamina: "0x50",
      last_refill_tick: "0x10",
      coord_x: 100,
      coord_y: 200,
      owner_address: "0xabc",
      owner_name: "TestPlayer",
    });

    const view = new ViewClient(sql);
    const client = { view } as any;
    const ctx: MapContext = { snapshot: null, filePath: null };
    const inspectTool = createInspectTool(client, ctx);

    ctx.snapshot = {
      text: "",
      headerLines: 0,
      rowCount: 1,
      colCount: 1,
      tiles: [],
      gridIndex: new Map(),
      resolve: (r, c) => (r === 1 && c === 1 ? { x: 100, y: 200 } : null),
      tileAt: (r, c) =>
        r === 1 && c === 1
          ? {
              position: { x: 100, y: 200 },
              biome: 11,
              occupierId: 99,
              occupierType: 15,
              occupierIsStructure: false,
              rewardExtracted: false,
            }
          : null,
    };

    const result = await inspectTool.execute("call-2", { row: 1, col: 1 });
    const text = result.content[0].text;
    // troop_category 1 = Paladin, troop_tier 2 = T3
    expect(text).toContain("Paladin T3");
    expect(text).toContain("TestPlayer");
    expect(text).toContain("Troops:");
  });
});
