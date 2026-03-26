import { describe, expect, it, vi, beforeEach } from "vitest";
import { attackTarget } from "../../../src/tools/core/attack";
import {
  createMockToolContext,
  defaultExplorer,
  DEFAULT_EXPLORER_POS,
  ADJACENT_EAST_POS,
  NON_ADJACENT_POS,
  PLAYER_ADDRESS,
  ENEMY_ADDRESS,
} from "./_fixtures";
import type { ToolContext } from "../../../src/tools/core/context";

// Direction.EAST = 0 in the even-r offset grid
const DIRECTION_EAST = 0;

describe("attackTarget", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  // ── Validation ──────────────────────────────────────────────────────

  describe("validation", () => {
    it("returns failure when army not found", async () => {
      // explorerInfo returns null by default
      const result = await attackTarget({ armyId: 99, targetX: 11, targetY: 10 }, ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain("99");
      expect(result.message).toContain("not found");
    });

    it("returns failure when army not owned by player", async () => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
        defaultExplorer({ ownerAddress: ENEMY_ADDRESS }),
      );

      const result = await attackTarget({ armyId: 1, targetX: 11, targetY: 10 }, ctx);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not yours");
    });

    it("returns failure when target is not adjacent", async () => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(defaultExplorer());

      const result = await attackTarget(
        { armyId: 1, targetX: NON_ADJACENT_POS.x, targetY: NON_ADJACENT_POS.y },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("not adjacent");
    });

    it("returns failure when target tile is empty (occupierType === 0)", async () => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(defaultExplorer());

      // Tile exists but is empty
      ctx.snapshot.gridIndex.set(`${ADJACENT_EAST_POS.x},${ADJACENT_EAST_POS.y}`, {
        position: ADJACENT_EAST_POS,
        biome: 5,
        occupierId: 0,
        occupierType: 0,
        occupierIsStructure: false,
        rewardExtracted: false,
      } as any);

      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Nothing to attack");
    });

    it("returns failure when target tile is not in gridIndex", async () => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(defaultExplorer());

      // gridIndex has no entry for the adjacent tile
      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Nothing to attack");
    });
  });

  // ── Explorer vs Explorer ────────────────────────────────────────────

  describe("explorer-vs-explorer", () => {
    const DEFENDER_ID = 42;

    beforeEach(() => {
      // Attacker explorer
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
        if (id === 1) return defaultExplorer();
        if (id === DEFENDER_ID)
          return defaultExplorer({
            entityId: DEFENDER_ID,
            ownerAddress: ENEMY_ADDRESS,
            troopCount: 500,
            troopType: "Paladin",
            troopTier: "T1",
            stamina: 80,
            staminaUpdatedTick: 0,
            position: ADJACENT_EAST_POS,
          });
        return null;
      });

      // Target tile has an explorer (occupierType 15+)
      // Biome 10 = Taiga — Knight +30%, neutral for Paladin defender
      ctx.snapshot.gridIndex.set(`${ADJACENT_EAST_POS.x},${ADJACENT_EAST_POS.y}`, {
        position: ADJACENT_EAST_POS,
        biome: 10,
        occupierId: DEFENDER_ID,
        occupierType: 15, // explorer range: 15-32
        occupierIsStructure: false,
        rewardExtracted: false,
      } as any);
    });

    it("calls attack_explorer_vs_explorer with correct params", async () => {
      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(ctx.provider.attack_explorer_vs_explorer).toHaveBeenCalledWith({
        aggressor_id: 1,
        defender_id: DEFENDER_ID,
        defender_direction: DIRECTION_EAST,
        steal_resources: [],
        signer: ctx.signer,
      });
    });

    it("returns VICTORY/DEFEAT message based on combat simulation", async () => {
      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(true);
      // 1000 Knight T1 vs 500 Paladin T1 — attacker should win
      expect(result.combat).not.toBeNull();
      expect(result.message).toContain("VICTORY");
      expect(result.combat!.winner).toBe("attacker");
    });
  });

  // ── Explorer vs Guard (Structure) ──────────────────────────────────

  describe("explorer-vs-guard (structure)", () => {
    const STRUCTURE_ENTITY_ID = 200;

    beforeEach(() => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(defaultExplorer());

      // Target tile has a structure (occupierType 1-14)
      ctx.snapshot.gridIndex.set(`${ADJACENT_EAST_POS.x},${ADJACENT_EAST_POS.y}`, {
        position: ADJACENT_EAST_POS,
        biome: 5,
        occupierId: STRUCTURE_ENTITY_ID,
        occupierType: 1, // structure range: 1-14
        occupierIsStructure: true,
        rewardExtracted: false,
      } as any);
    });

    it("calls attack_explorer_vs_guard for structure target", async () => {
      (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
        entityId: STRUCTURE_ENTITY_ID,
        guards: [{ slot: "0", troopType: "Knight", troopTier: "T1", count: 300 }],
      });

      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(ctx.provider.attack_explorer_vs_guard).toHaveBeenCalledWith({
        explorer_id: 1,
        structure_id: STRUCTURE_ENTITY_ID,
        structure_direction: DIRECTION_EAST,
        signer: ctx.signer,
      });
      expect(result.combat).not.toBeNull();
    });

    it("unguarded structure results in free capture with combat: null", async () => {
      (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
        entityId: STRUCTURE_ENTITY_ID,
        guards: [], // No guards
      });

      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(result.combat).toBeNull();
      expect(result.message).toContain("Captured");
      expect(result.message).toContain("unguarded");
    });
  });

  // ── Error handling ──────────────────────────────────────────────────

  describe("error handling", () => {
    it("returns failure with extracted error when provider throws", async () => {
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(defaultExplorer());

      // Target tile has an explorer
      ctx.snapshot.gridIndex.set(`${ADJACENT_EAST_POS.x},${ADJACENT_EAST_POS.y}`, {
        position: ADJACENT_EAST_POS,
        biome: 5,
        occupierId: 42,
        occupierType: 15,
        occupierIsStructure: false,
        rewardExtracted: false,
      } as any);

      // Defender info for simulation
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
        if (id === 1) return defaultExplorer();
        if (id === 42)
          return defaultExplorer({
            entityId: 42,
            ownerAddress: ENEMY_ADDRESS,
            troopCount: 500,
            position: ADJACENT_EAST_POS,
          });
        return null;
      });

      // Provider throws an error
      (ctx.provider.attack_explorer_vs_explorer as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("insufficient stamina, you need: 30, and have: 10"),
      );

      const result = await attackTarget(
        { armyId: 1, targetX: ADJACENT_EAST_POS.x, targetY: ADJACENT_EAST_POS.y },
        ctx,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Attack failed");
      expect(result.combat).toBeNull();
    });
  });

  // ── Coordinate conversion ──────────────────────────────────────────

  describe("coordinate conversion", () => {
    it("converts display coords via toContractX/toContractY with mapCenter", async () => {
      const mapCenter = 2147483647; // large offset like real game
      ctx.mapCenter = mapCenter;

      // With mapCenter, display (0,0) maps to contract (mapCenter, mapCenter)
      // Explorer at contract position (mapCenter, mapCenter)
      const explorerPos = { x: mapCenter, y: mapCenter };
      // East neighbor in even-r grid: (mapCenter+1, mapCenter)
      const targetContractPos = { x: mapCenter + 1, y: mapCenter };

      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
        defaultExplorer({ position: explorerPos }),
      );

      // Display coords: targetX = contract - mapCenter = 1, targetY = -(contract - mapCenter) = 0
      const displayTargetX = targetContractPos.x - mapCenter; // 1
      const displayTargetY = -(targetContractPos.y - mapCenter); // 0

      // Set up the tile at the contract coordinates
      ctx.snapshot.gridIndex.set(`${targetContractPos.x},${targetContractPos.y}`, {
        position: targetContractPos,
        biome: 5,
        occupierId: 50,
        occupierType: 15,
        occupierIsStructure: false,
        rewardExtracted: false,
      } as any);

      // Defender explorer at target
      (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
        if (id === 1)
          return defaultExplorer({ position: explorerPos });
        if (id === 50)
          return defaultExplorer({
            entityId: 50,
            ownerAddress: ENEMY_ADDRESS,
            troopCount: 500,
            position: targetContractPos,
          });
        return null;
      });

      const result = await attackTarget(
        { armyId: 1, targetX: displayTargetX, targetY: displayTargetY },
        ctx,
      );

      expect(result.success).toBe(true);
      expect(ctx.provider.attack_explorer_vs_explorer).toHaveBeenCalledWith(
        expect.objectContaining({
          aggressor_id: 1,
          defender_id: 50,
          defender_direction: DIRECTION_EAST,
        }),
      );
    });
  });
});
