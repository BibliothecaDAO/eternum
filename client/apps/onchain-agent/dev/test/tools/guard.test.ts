import { describe, expect, it, vi, beforeEach } from "vitest";
import { guardFromStorage, guardFromArmy, unguardToArmy } from "../../../src/tools/core/guard";
import {
  createMockToolContext,
  defaultExplorer,
  DEFAULT_EXPLORER_POS,
  ADJACENT_EAST_POS,
  NON_ADJACENT_POS,
} from "./_fixtures";
import type { ToolContext } from "../../../src/tools/core/context";

/**
 * RESOURCE_PRECISION = 1_000_000_000 in @bibliothecadao/types.
 * Guard functions scale user-facing amounts by this factor before sending to chain.
 */
const RESOURCE_PRECISION = 1_000_000_000;

/** Direction.EAST = 0, Direction.WEST = 3 in the even-r offset grid. */
const DIRECTION_EAST = 0;
const DIRECTION_WEST = 3;

/** Structure entity ID used across tests. */
const STRUCTURE_ID = 42;

/** Army entity ID used across tests. */
const ARMY_ID = 1;

/**
 * Helper: set up ctx.snapshot.tiles so the structure is found at a given position.
 */
function placeStructure(ctx: ToolContext, pos: { x: number; y: number }, structureId = STRUCTURE_ID) {
  (ctx.snapshot as any).tiles = [{ occupierId: structureId, position: pos }];
}

describe("guardFromStorage", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it("maps Knight → category 0, Paladin → 1, Crossbowman → 2", async () => {
    const types: Array<["Knight" | "Paladin" | "Crossbowman", number]> = [
      ["Knight", 0],
      ["Paladin", 1],
      ["Crossbowman", 2],
    ];

    for (const [troopType, expectedCategory] of types) {
      const fresh = createMockToolContext();
      await guardFromStorage(
        { structureId: STRUCTURE_ID, slot: 0, troopType, tier: 1, amount: 1 },
        fresh,
      );
      expect((fresh.provider.guard_add as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
        category: expectedCategory,
      });
    }
  });

  it("maps tier 1 → tierValue 0, tier 2 → 1, tier 3 → 2", async () => {
    for (let tier = 1; tier <= 3; tier++) {
      const fresh = createMockToolContext();
      await guardFromStorage(
        { structureId: STRUCTURE_ID, slot: 0, troopType: "Knight", tier, amount: 1 },
        fresh,
      );
      expect((fresh.provider.guard_add as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
        tier: tier - 1,
      });
    }
  });

  it("scales amount by RESOURCE_PRECISION", async () => {
    await guardFromStorage(
      { structureId: STRUCTURE_ID, slot: 0, troopType: "Knight", tier: 1, amount: 5 },
      ctx,
    );
    expect((ctx.provider.guard_add as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      amount: 5 * RESOURCE_PRECISION,
    });
  });

  it("calls provider.guard_add with correct payload", async () => {
    await guardFromStorage(
      { structureId: STRUCTURE_ID, slot: 2, troopType: "Paladin", tier: 2, amount: 10 },
      ctx,
    );

    expect(ctx.provider.guard_add).toHaveBeenCalledOnce();
    expect((ctx.provider.guard_add as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      for_structure_id: STRUCTURE_ID,
      slot: 2,
      category: 1,
      tier: 1,
      amount: 10 * RESOURCE_PRECISION,
      signer: ctx.signer,
    });
  });

  it("returns success with slot name (Alpha/Bravo/Charlie/Delta)", async () => {
    const slotNames = ["Alpha", "Bravo", "Charlie", "Delta"];
    for (let slot = 0; slot < 4; slot++) {
      const fresh = createMockToolContext();
      const result = await guardFromStorage(
        { structureId: STRUCTURE_ID, slot, troopType: "Knight", tier: 1, amount: 1 },
        fresh,
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain(slotNames[slot]);
    }
  });

  it("tx error → failure with 'Guard failed:' message", async () => {
    (ctx.provider.guard_add as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("some chain error that is long enough"),
    );

    const result = await guardFromStorage(
      { structureId: STRUCTURE_ID, slot: 0, troopType: "Knight", tier: 1, amount: 1 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/^Guard failed:/);
  });
});

describe("guardFromArmy", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
    // Explorer at (10,10), structure at (11,10) — adjacent EAST
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: ARMY_ID, position: DEFAULT_EXPLORER_POS }),
    );
    placeStructure(ctx, ADJACENT_EAST_POS);
  });

  it("army not found → failure 'Army X not found.'", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await guardFromArmy(
      { armyId: 99, structureId: STRUCTURE_ID, slot: 0, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Army 99 not found.");
  });

  it("structure not in snapshot tiles → 'Cannot determine direction to structure.'", async () => {
    (ctx.snapshot as any).tiles = []; // no structure in tiles

    const result = await guardFromArmy(
      { armyId: ARMY_ID, structureId: STRUCTURE_ID, slot: 0, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot determine direction to structure.");
  });

  it("army not adjacent to structure → 'not adjacent...Move first.'", async () => {
    placeStructure(ctx, NON_ADJACENT_POS);

    const result = await guardFromArmy(
      { armyId: ARMY_ID, structureId: STRUCTURE_ID, slot: 0, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("not adjacent");
    expect(result.message).toContain("Move first");
  });

  it("success: calls explorer_guard_swap with direction FROM explorer TO structure", async () => {
    const result = await guardFromArmy(
      { armyId: ARMY_ID, structureId: STRUCTURE_ID, slot: 1, amount: 10 },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(ctx.provider.explorer_guard_swap).toHaveBeenCalledOnce();
    expect((ctx.provider.explorer_guard_swap as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      from_explorer_id: ARMY_ID,
      to_structure_id: STRUCTURE_ID,
      to_structure_direction: DIRECTION_EAST, // explorer(10,10) → structure(11,10) = EAST
      to_guard_slot: 1,
      count: 10 * RESOURCE_PRECISION,
      signer: ctx.signer,
    });
  });

  it("scales amount by RESOURCE_PRECISION", async () => {
    await guardFromArmy(
      { armyId: ARMY_ID, structureId: STRUCTURE_ID, slot: 0, amount: 3 },
      ctx,
    );

    expect((ctx.provider.explorer_guard_swap as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      count: 3 * RESOURCE_PRECISION,
    });
  });
});

describe("unguardToArmy", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
    // Explorer at (10,10), structure at (11,10) — adjacent
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: ARMY_ID, position: DEFAULT_EXPLORER_POS }),
    );
    placeStructure(ctx, ADJACENT_EAST_POS);
  });

  it("army not found → failure", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await unguardToArmy(
      { structureId: STRUCTURE_ID, slot: 0, armyId: 99, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("structure not in snapshot tiles → 'not found on map'", async () => {
    (ctx.snapshot as any).tiles = [];

    const result = await unguardToArmy(
      { structureId: STRUCTURE_ID, slot: 0, armyId: ARMY_ID, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found on map");
  });

  it("army not adjacent to structure → 'not adjacent...Move first.'", async () => {
    placeStructure(ctx, NON_ADJACENT_POS);

    const result = await unguardToArmy(
      { structureId: STRUCTURE_ID, slot: 0, armyId: ARMY_ID, amount: 5 },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("not adjacent");
    expect(result.message).toContain("Move first");
  });

  it("direction is FROM structure TO explorer (OPPOSITE of guardFromArmy)", async () => {
    const result = await unguardToArmy(
      { structureId: STRUCTURE_ID, slot: 2, armyId: ARMY_ID, amount: 7 },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(ctx.provider.guard_explorer_swap).toHaveBeenCalledOnce();

    const call = (ctx.provider.guard_explorer_swap as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // guardFromArmy uses direction EAST (explorer→structure).
    // unguardToArmy uses direction WEST (structure→explorer). They are OPPOSITE.
    expect(call.to_explorer_direction).toBe(DIRECTION_WEST);
  });

  it("calls guard_explorer_swap with correct full payload", async () => {
    await unguardToArmy(
      { structureId: STRUCTURE_ID, slot: 3, armyId: ARMY_ID, amount: 12 },
      ctx,
    );

    expect((ctx.provider.guard_explorer_swap as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      from_structure_id: STRUCTURE_ID,
      from_guard_slot: 3,
      to_explorer_id: ARMY_ID,
      to_explorer_direction: DIRECTION_WEST, // structure(11,10) → explorer(10,10) = WEST
      count: 12 * RESOURCE_PRECISION,
      signer: ctx.signer,
    });
  });
});
