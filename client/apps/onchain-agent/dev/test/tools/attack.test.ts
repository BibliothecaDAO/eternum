import { describe, it, expect, vi } from "vitest";
import { createAttackTool } from "../../../src/tools/attack.js";
import type { MapContext } from "../../../src/map/context.js";
import type { MapSnapshot } from "../../../src/map/renderer.js";
import type { TxContext } from "../../../src/tools/tx-context.js";
import type { TileState, EternumClient, ExplorerInfo, StructureInfo } from "@bibliothecadao/client";
import type { GameConfig } from "@bibliothecadao/torii";

// ── Helpers ──────────────────────────────────────────────────────────

const PLAYER = "0x123";

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
    anchor,
  };
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
    paladinMaxStamina: 120,
    crossbowmanMaxStamina: 100,
    armiesTickInSeconds: 1,
  },
};

function makeExplorer(x: number, y: number, opts: Partial<ExplorerInfo> = {}): ExplorerInfo {
  // Set staminaUpdatedTick to the current tick so projectExplorerStamina
  // returns the raw stamina value (no regen projection in tests).
  const currentTick = Math.floor(Date.now() / 1000);
  return {
    entityId: 1,
    ownerName: "TestPlayer",
    ownerAddress: PLAYER,
    troopType: "Paladin",
    troopTier: "T2",
    troopCount: 2000,
    stamina: 80,
    staminaUpdatedTick: currentTick,
    position: { x, y },
    ...opts,
  };
}

function makeDefender(x: number, y: number, opts: Partial<ExplorerInfo> = {}): ExplorerInfo {
  const currentTick = Math.floor(Date.now() / 1000);
  return {
    entityId: 42,
    ownerName: "Enemy",
    ownerAddress: "0x456",
    troopType: "Knight",
    troopTier: "T1",
    troopCount: 1000,
    stamina: 60,
    staminaUpdatedTick: currentTick,
    position: { x, y },
    ...opts,
  };
}

function makeStructure(x: number, y: number, guards: StructureInfo["guards"] = []): StructureInfo {
  return {
    entityId: 99,
    category: "Mine",
    level: 1,
    realmId: 0,
    ownerAddress: "0x789",
    position: { x, y },
    guards,
    resources: [{ name: "Essence", amount: 500 }],
    explorerCount: 0,
    maxExplorerCount: 3,
  };
}

function makeClient(
  explorer: ExplorerInfo | null,
  defender: ExplorerInfo | null = null,
  structure: StructureInfo | null = null,
): EternumClient {
  return {
    view: {
      explorerInfo: vi.fn().mockImplementation((id: number) => {
        if (explorer && id === explorer.entityId) return Promise.resolve(explorer);
        if (defender && id === defender.entityId) return Promise.resolve(defender);
        return Promise.resolve(null);
      }),
      structureAt: vi.fn().mockResolvedValue(structure),
    },
  } as unknown as EternumClient;
}

function makeTxCtx(): TxContext {
  return {
    provider: {
      attack_explorer_vs_explorer: vi.fn().mockResolvedValue({}),
      attack_explorer_vs_guard: vi.fn().mockResolvedValue({}),
    },
    signer: {},
  } as unknown as TxContext;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("attack — prerequisites", () => {
  it("throws when no map is loaded", async () => {
    const mapCtx: MapContext = { snapshot: null, filePath: null };
    const tool = createAttackTool(makeClient(null), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "Map not loaded",
    );
  });

  it("throws when no army at position", async () => {
    const tiles = [makeTile(0, 0), makeTile(1, 0)]; // no explorer
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createAttackTool(makeClient(null), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "No army at",
    );
  });

  it("throws when army is not yours", async () => {
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0, 15, 42)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const explorer = makeExplorer(0, 0, { ownerAddress: "0xENEMY" });
    const tool = createAttackTool(makeClient(explorer), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "not yours",
    );
  });
});

describe("attack — adjacency", () => {
  it("throws for non-adjacent target", async () => {
    const tiles: TileState[] = [];
    for (let x = 0; x <= 5; x++) {
      for (let y = 0; y <= 5; y++) {
        const isAttacker = x === 0 && y === 0;
        const isEnemy = x === 5 && y === 5;
        tiles.push(makeTile(x, y, isAttacker ? 15 : isEnemy ? 15 : 0, isAttacker ? 1 : isEnemy ? 42 : 0));
      }
    }
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const attacker = makeExplorer(0, 0);
    const tool = createAttackTool(makeClient(attacker), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    // Target at (5,5) → map row=1 (top, since maxY=5), col=6
    await expect(tool.execute("id", { army_row: 6, army_col: 1, target_row: 1, target_col: 6 })).rejects.toThrow(
      "not adjacent",
    );
  });
});

describe("attack — stamina check", () => {
  it("throws when stamina below threshold", async () => {
    // Attacker at (0,0) with low stamina, enemy at (1,0) — adjacent (EAST)
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0, 15, 42)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const attacker = makeExplorer(0, 0, { stamina: 30 });
    const tool = createAttackTool(makeClient(attacker), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "Not enough stamina",
    );
  });
});

describe("attack — empty tile", () => {
  it("throws on attack on empty tile", async () => {
    const tiles = [makeTile(0, 0, 15, 1), makeTile(1, 0)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const tool = createAttackTool(makeClient(makeExplorer(0, 0)), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    await expect(tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 })).rejects.toThrow(
      "empty",
    );
  });
});

describe("attack — vs explorer", () => {
  it("attacks with strength comparison", async () => {
    // Attacker: 2000 Paladin T2 at (0,0), Grassland biome
    // Defender: 1000 Knight T1 at (1,0)
    const tiles = [makeTile(0, 0, 15, 1, 11), makeTile(1, 0, 15, 42, 11)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const attacker = makeExplorer(0, 0);
    const defender = makeDefender(1, 0);
    const tool = createAttackTool(makeClient(attacker, defender), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    const result = await tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 });
    const text = result.content[0].text;

    // Attacker: 2000 * 250/100 = 5000, Paladin +30% on Grassland
    expect(text).toContain("Your strength: 5,000 (+30% on this tile)");
    // Defender: 1000 * 100/100 = 1000, Knight neutral on Grassland
    expect(text).toContain("Their strength: 1,000");
    expect(text).toContain("Ratio: 5.0x");
  });
});

describe("attack — vs structure", () => {
  it("attacks guarded structure", async () => {
    // Attacker: 2000 Paladin T2 at (0,0)
    // Structure at (1,0) with 500 Crossbowman T1 guards
    const tiles = [
      makeTile(0, 0, 15, 1, 11),
      makeTile(1, 0, 1, 99, 11), // structure type 1
    ];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const attacker = makeExplorer(0, 0);
    const structure = makeStructure(1, 0, [{ slot: "front", troopType: "Crossbowman", troopTier: "T1", count: 500 }]);
    const tool = createAttackTool(makeClient(attacker, null, structure), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    const result = await tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 });
    const text = result.content[0].text;

    expect(text).toContain("Mine guards");
    expect(text).toContain("Your strength: 5,000");
    // Guards: 500 * 100/100 = 500, Crossbowman -30% on Grassland
    expect(text).toContain("Guard strength: 500 (-30% on this tile)");
    expect(text).toContain("Ratio: 10.0x");
  });

  it("attacks unguarded structure to capture", async () => {
    const tiles = [makeTile(0, 0, 15, 1, 11), makeTile(1, 0, 1, 99, 11)];
    const mapCtx: MapContext = { snapshot: makeSnapshot(tiles), filePath: null };
    const attacker = makeExplorer(0, 0);
    const structure = makeStructure(1, 0, []); // no guards
    const tool = createAttackTool(makeClient(attacker, null, structure), mapCtx, PLAYER, makeTxCtx(), testGameConfig);

    const result = await tool.execute("id", { army_row: 1, army_col: 1, target_row: 1, target_col: 2 });
    expect(result.content[0].text).toContain("unguarded");
    expect(result.content[0].text).toContain("attacking to capture");
  });
});
