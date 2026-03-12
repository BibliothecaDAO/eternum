import { describe, it, expect, vi } from "vitest";
import { createMoveTool } from "../../../src/tools/move.js";
import type { MapContext } from "../../../src/map/context.js";
import type { MapSnapshot } from "../../../src/map/renderer.js";
import type { TxContext } from "../../../src/tools/tx-context.js";
import type { TileState, EternumClient, ExplorerInfo } from "@bibliothecadao/client";
import type { GameConfig } from "@bibliothecadao/torii";

// ── Test helpers ─────────────────────────────────────────────────────

const PLAYER = "0x123";

function makeTile(x: number, y: number, occupierType = 0, occupierId = 0): TileState {
  return {
    position: { x, y },
    biome: 11,
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
    anchor,
  };
}

function makeExplorer(x: number, y: number, stamina: number, opts: Partial<ExplorerInfo> = {}): ExplorerInfo {
  // Set staminaUpdatedTick to the current tick so projectExplorerStamina
  // returns the raw stamina value (no regen projection in tests).
  const currentTick = Math.floor(Date.now() / 1000);
  return {
    entityId: 1,
    ownerName: "TestPlayer",
    ownerAddress: PLAYER,
    troopType: "Paladin",
    troopTier: "T1",
    troopCount: 100,
    stamina,
    staminaUpdatedTick: currentTick,
    position: { x, y },
    ...opts,
  };
}

function makeClient(explorer: ExplorerInfo | null): EternumClient {
  return {
    view: {
      explorerInfo: vi.fn().mockResolvedValue(explorer),
    },
  } as unknown as EternumClient;
}

function makeTxCtx(): TxContext {
  return {
    provider: {
      explorer_travel: vi.fn().mockResolvedValue({}),
    },
    signer: {},
  } as unknown as TxContext;
}

const testGameConfig: GameConfig = {
  buildingCosts: {},
  resourceFactories: {},
  buildingBaseCostPercentIncrease: 0,
  realmUpgradeCosts: {},
  stamina: {
    travelCost: 20,
    exploreCost: 30,
    bonusValue: 10,
    gainPerTick: 1,
    knightMaxStamina: 100,
    paladinMaxStamina: 100,
    crossbowmanMaxStamina: 100,
    armiesTickInSeconds: 1,
  },
};

// ── Tests ────────────────────────────────────────────────────────────

describe("move_army — prerequisites", () => {
  it("throws when no map is loaded", async () => {
    const mapCtx: MapContext = { snapshot: null, filePath: null };
    const tool = createMoveTool(makeClient(null), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "Map not loaded",
    );
  });

  it("throws for invalid from coordinates", async () => {
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 0, 100)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 99, army_col: 99, target_row: 1, target_col: 1 })).rejects.toThrow(
      "Invalid army position",
    );
  });

  it("throws for invalid to coordinates", async () => {
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 0, 100)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 99, target_col: 99 })).rejects.toThrow(
      "Invalid target position",
    );
  });

  it("throws when no army at from position", async () => {
    const tiles = [makeTile(0, 0), makeTile(1, 0)]; // no explorer at (0,0)
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(null), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "No army at",
    );
  });

  it("throws when army is not yours", async () => {
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const explorer = makeExplorer(0, 0, 100, { ownerAddress: "0xENEMY" });
    const tool = createMoveTool(makeClient(explorer), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "not yours",
    );
  });
});

describe("move_army — already at target", () => {
  it("throws already-there message", async () => {
    const tiles = [makeTile(5, 5, 15, 1)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(5, 5, 100)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 1 })).rejects.toThrow(
      "Already at",
    );
  });
});

describe("move_army — no stamina", () => {
  it("throws no stamina", async () => {
    // 3x1 corridor: explorer at (0,0), target at (2,0)
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0), makeTile(2, 0)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 0, 0)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 3 })).rejects.toThrow(
      "no stamina",
    );
  });
});

describe("move_army — successful move", () => {
  it("moves with stamina accounting", async () => {
    // 5x1 row of tiles at y=0, x=0..4. Explorer at x=0.
    const tiles = [makeTile(0, 0, 15, 1), ...Array.from({ length: 4 }, (_, i) => makeTile(i + 1, 0))];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 0, 100)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    // Move from (0,0) col=1 to (3,0) col=4
    const result = await tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 4 });
    expect((result.content[0] as any).text).toContain("3 steps");
    // Paladin on Grassland (biome 11): cost = 20 - 10 = 10 per hex. 3 * 10 = 30. 100 - 30 = 70.
    expect((result.content[0] as any).text).toContain("100 → 70");
    // movesAfter = floor(70 / 20) = 3
    expect((result.content[0] as any).text).toContain("3 moves remaining");
  });

  it("moves as far as possible when target exceeds stamina", async () => {
    // Long row: explorer at x=0 with only 20 stamina, Paladin on Grassland = 10/hex → 2 steps max
    const tiles = [makeTile(0, 0, 15, 1), ...Array.from({ length: 19 }, (_, i) => makeTile(i + 1, 0))];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 0, 20)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    const result = await tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 11 });
    // Should move 2 steps (20 stamina / 10 per hex) toward target, not throw
    expect((result.content[0] as any).text).toContain("2 steps toward");
    expect((result.content[0] as any).text).toContain("ran out of stamina");
    expect((result.content[0] as any).text).toContain("20 → 0");
  });
});

describe("move_army — obstacle avoidance", () => {
  it("routes around a structure", async () => {
    // 5x3 grid, structure at (2,1), explorer at (0,1)
    const tiles: TileState[] = [];
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 3; y++) {
        if (x === 0 && y === 1) {
          tiles.push(makeTile(x, y, 15, 1)); // explorer
        } else if (x === 2 && y === 1) {
          tiles.push(makeTile(x, y, 1, 99)); // structure
        } else {
          tiles.push(makeTile(x, y));
        }
      }
    }
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createMoveTool(makeClient(makeExplorer(0, 1, 200)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    // (0,1) → maxY=2, y=1 → row=2. minX=0, x=0 → col=1
    // (4,1) → row=2, col=5
    const result = await tool.execute("id", { army_row: 2, army_col: 1, target_row: 2, target_col: 5 });
    expect((result.content[0] as any).text).toContain("steps");
    const details = result.details as any;
    expect(details.distance).toBeGreaterThanOrEqual(4);
  });
});
