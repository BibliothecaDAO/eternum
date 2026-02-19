import { describe, it, expect, vi, beforeEach } from "vitest";
import { moveExplorer, type MoveRequest } from "../../src/adapter/move-executor";
import type { EternumWorldState, EternumEntity } from "../../src/adapter/world-state";
import type { TileInfo } from "../../src/adapter/pathfinder";
import { BiomeTypeToId, BiomeType } from "@bibliothecadao/types";

// Mock executeAction
vi.mock("../../src/adapter/action-registry", () => ({
  executeAction: vi.fn(),
  // Keep other exports stubbed
  getActionHandler: vi.fn(),
  getAvailableActions: vi.fn(() => []),
  getActionDefinitions: vi.fn(() => []),
  setWorldStateProvider: vi.fn(),
}));

import { executeAction } from "../../src/adapter/action-registry";
const mockExecuteAction = vi.mocked(executeAction);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorldState(
  entities: Partial<EternumEntity>[],
  tiles: { col: number; row: number; biome: BiomeType }[] = [],
): EternumWorldState {
  const tileMap = new Map<string, TileInfo>();
  for (const t of tiles) {
    tileMap.set(`${t.col},${t.row}`, {
      biome: BiomeTypeToId[t.biome],
      occupierType: 0,
      occupierId: 0,
    });
  }

  return {
    tick: 1,
    timestamp: Date.now(),
    entities: entities as EternumEntity[],
    resources: new Map(),
    player: { address: "0x1", name: "test", structures: 0, armies: 0, points: 0, rank: 0 },
    market: { recentSwapCount: 0, openOrderCount: 0 },
    leaderboard: { topPlayers: [], totalPlayers: 0 },
    recentBattles: [],
    tileMap,
  };
}

const dummyClient = {} as any;
const dummySigner = {} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("moveExplorer", () => {
  beforeEach(() => {
    mockExecuteAction.mockReset();
  });

  it("returns error when explorer not found", async () => {
    const ws = makeWorldState([]);
    const result = await moveExplorer(dummyClient, dummySigner, {
      explorerId: 999,
      targetCol: 10,
      targetRow: 10,
    }, ws);

    expect(result.success).toBe(false);
    expect(result.pathFound).toBe(false);
    expect(result.summary).toContain("not found");
  });

  it("returns success with 0 steps when already at target", async () => {
    const ws = makeWorldState([
      { type: "army", entityId: 1, position: { x: 5, y: 4 }, isOwned: true },
    ]);
    const result = await moveExplorer(dummyClient, dummySigner, {
      explorerId: 1,
      targetCol: 5,
      targetRow: 4,
    }, ws);

    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(0);
    expect(result.summary).toContain("already at");
  });

  it("returns pathFound=false when no path exists", async () => {
    // Explorer at (0,4), target at (2,4) but (1,4) is ocean and neighbors blocked
    const ws = makeWorldState(
      [{ type: "army", entityId: 1, position: { x: 0, y: 4 }, isOwned: true }],
      [
        { col: 0, row: 4, biome: BiomeType.Grassland },
        { col: 2, row: 4, biome: BiomeType.Ocean }, // target is ocean
      ],
    );
    const result = await moveExplorer(dummyClient, dummySigner, {
      explorerId: 1,
      targetCol: 2,
      targetRow: 4,
    }, ws);

    expect(result.pathFound).toBe(false);
    expect(result.success).toBe(false);
  });

  it("executes all batches on success", async () => {
    // Explorer at (0,4), target at (2,4), all explored grassland
    const tiles = [
      { col: 0, row: 4, biome: BiomeType.Grassland },
      { col: 1, row: 4, biome: BiomeType.Grassland },
      { col: 2, row: 4, biome: BiomeType.Grassland },
    ];
    const ws = makeWorldState(
      [{ type: "army", entityId: 1, position: { x: 0, y: 4 }, isOwned: true }],
      tiles,
    );

    mockExecuteAction.mockResolvedValue({ success: true, txHash: "0xabc" });

    const result = await moveExplorer(dummyClient, dummySigner, {
      explorerId: 1,
      targetCol: 2,
      targetRow: 4,
    }, ws);

    expect(result.success).toBe(true);
    expect(result.pathFound).toBe(true);
    // 2 explored tiles = 1 travel batch
    expect(result.steps.length).toBe(1);
    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain("moved from");
  });

  it("stops on first failure and reports failedAtStep", async () => {
    // 3 unexplored tiles = 3 explore batches, fail on the 2nd
    const ws = makeWorldState(
      [{ type: "army", entityId: 1, position: { x: 0, y: 4 }, isOwned: true }],
      [], // all unexplored
    );

    mockExecuteAction
      .mockResolvedValueOnce({ success: true, txHash: "0x1" })
      .mockResolvedValueOnce({ success: false, error: "stamina depleted" })
      .mockResolvedValueOnce({ success: true, txHash: "0x3" }); // should never be called

    const result = await moveExplorer(dummyClient, dummySigner, {
      explorerId: 1,
      targetCol: 3,
      targetRow: 4,
    }, ws);

    expect(result.success).toBe(false);
    expect(result.pathFound).toBe(true);
    expect(result.failedAtStep).toBe(1); // 0-indexed, second batch
    expect(result.steps.length).toBe(2); // completed + failed
    expect(mockExecuteAction).toHaveBeenCalledTimes(2); // didn't call the 3rd
    expect(result.summary).toContain("stamina depleted");
  });
});
