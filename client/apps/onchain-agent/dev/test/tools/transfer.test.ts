import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  sendResources,
  transferToStructure,
  transferToArmy,
  transferTroops,
} from "../../../src/tools/core/transfer";
import {
  createMockToolContext,
  defaultExplorer,
  DEFAULT_EXPLORER_POS,
  ADJACENT_EAST_POS,
  NON_ADJACENT_POS,
} from "./_fixtures";
import type { ToolContext } from "../../../src/tools/core/context";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

describe("sendResources", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it("rejects same structure (fromStructureId === toStructureId)", async () => {
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 1, resources: [{ resourceId: 1, amount: 100 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Cannot send to the same structure.");
  });

  it("rejects empty resources array", async () => {
    const result = await sendResources({ fromStructureId: 1, toStructureId: 2, resources: [] }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toBe("No resources specified.");
  });

  it("scales resources by RESOURCE_PRECISION", async () => {
    // Set up tiles so structures are found
    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];
    // Return structure with enough donkeys
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 100 }],
    });

    await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 10 }] },
      ctx,
    );

    const call = (ctx.provider.send_resources as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.resources[0].amount).toBe(Math.floor(10 * RESOURCE_PRECISION));
  });

  it("computes donkeysNeeded from weight * amount / capacity", async () => {
    // Set weight map: resource 5 weighs 1000g per unit
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];
    // Neither side has donkeys → failure with donkeysNeeded reported
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 0 }],
    });

    // 100 units * 1000g = 100,000g total weight, capacity 50,000 → need 2 donkeys
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 100 }] },
      ctx,
    );

    expect(result.donkeysNeeded).toBe(2);
  });

  it("uses sender donkeys when sufficient (mode:'send', calls send_resources)", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    // Sender (structure 1) has 10 donkeys, recipient has 0
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockImplementation(async (x: number) => {
      if (x === 0) return { resources: [{ name: "Donkey", amount: 10 }] };
      return { resources: [{ name: "Donkey", amount: 0 }] };
    });

    // 50 units * 1000g = 50,000g → 1 donkey needed
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 50 }] },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.mode).toBe("send");
    expect(ctx.provider.send_resources).toHaveBeenCalled();
  });

  it("falls back to pickup when sender lacks donkeys but recipient has enough", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    // Sender has 0 donkeys, recipient has 10
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockImplementation(async (x: number) => {
      if (x === 0) return { resources: [{ name: "Donkey", amount: 0 }] };
      return { resources: [{ name: "Donkey", amount: 10 }] };
    });

    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 50 }] },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.mode).toBe("pickup");
    expect(ctx.provider.pickup_resources).toHaveBeenCalled();
  });

  it("returns failure when neither has enough donkeys", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 0 }],
    });

    // 50 * 1000 = 50000g → 1 donkey needed, neither has any
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 50 }] },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("donkeys");
    expect(result.donkeysNeeded).toBe(1);
  });

  it("falls through to pickup on donkey-related tx error from send", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    // Both have enough donkeys
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 10 }],
    });

    // send_resources throws a donkey-related error
    (ctx.provider.send_resources as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not enough Donkey available"),
    );

    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 50 }] },
      ctx,
    );

    // Should fall through to pickup
    expect(result.success).toBe(true);
    expect(result.mode).toBe("pickup");
    expect(ctx.provider.pickup_resources).toHaveBeenCalled();
  });

  it("returns failure on non-donkey tx error from send (no fallthrough)", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    // Sender has enough donkeys, recipient has 0
    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockImplementation(async (x: number) => {
      if (x === 0) return { resources: [{ name: "Donkey", amount: 10 }] };
      return { resources: [{ name: "Donkey", amount: 0 }] };
    });

    // send_resources throws a non-donkey error
    (ctx.provider.send_resources as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("insufficient resources for transfer"),
    );

    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 50 }] },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Send failed");
    expect(ctx.provider.pickup_resources).not.toHaveBeenCalled();
  });

  it("uses default weight (0) when resource not in weightMap → 0 donkeys needed", async () => {
    // Weight map exists but doesn't have resource 99
    (ctx as any).resourceWeightGrams = new Map([[5, 1000]]);
    (ctx as any).donkeyCapacityGrams = 50_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 0 }],
    });

    // Resource 99 is not in the weight map → weight defaults to 0 → 0 donkeys
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 99, amount: 1000 }] },
      ctx,
    );

    // 0 donkeys needed, so send path should be taken (senderDonkeys 0 >= donkeysNeeded 0)
    expect(result.success).toBe(true);
    expect(result.donkeysNeeded).toBe(0);
  });

  it("reports donkeysNeeded in result", async () => {
    (ctx as any).resourceWeightGrams = new Map([[5, 500]]);
    (ctx as any).donkeyCapacityGrams = 10_000;

    (ctx.snapshot as any).tiles = [
      { occupierId: 1, position: { x: 0, y: 0 } },
      { occupierId: 2, position: { x: 1, y: 0 } },
    ];

    (ctx.client.view.structureAt as ReturnType<typeof vi.fn>).mockResolvedValue({
      resources: [{ name: "Donkey", amount: 100 }],
    });

    // 100 * 500 = 50,000g / 10,000 capacity = 5 donkeys
    const result = await sendResources(
      { fromStructureId: 1, toStructureId: 2, resources: [{ resourceId: 5, amount: 100 }] },
      ctx,
    );

    expect(result.donkeysNeeded).toBe(5);
  });
});

describe("transferToStructure", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it("rejects empty resources", async () => {
    const result = await transferToStructure({ armyId: 1, structureId: 2, resources: [] }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toBe("No resources specified.");
  });

  it("army not found → failure", async () => {
    const result = await transferToStructure(
      { armyId: 99, structureId: 2, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("structure not in snapshot tiles → 'Structure X not found.'", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS }),
    );
    // snapshot.tiles is empty → structure won't be found

    const result = await transferToStructure(
      { armyId: 1, structureId: 42, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Structure 42 not found.");
  });

  it("army not adjacent to structure → 'Move first.'", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS }),
    );
    (ctx.snapshot as any).tiles = [{ occupierId: 2, position: NON_ADJACENT_POS }];

    const result = await transferToStructure(
      { armyId: 1, structureId: 2, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Move first");
  });

  it("success: calls troop_structure_adjacent_transfer with scaled resources", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS }),
    );
    (ctx.snapshot as any).tiles = [{ occupierId: 2, position: ADJACENT_EAST_POS }];

    const result = await transferToStructure(
      { armyId: 1, structureId: 2, resources: [{ resourceId: 5, amount: 10 }] },
      ctx,
    );

    expect(result.success).toBe(true);
    const call = (ctx.provider.troop_structure_adjacent_transfer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.from_explorer_id).toBe(1);
    expect(call.to_structure_id).toBe(2);
    expect(call.resources[0].amount).toBe(Math.floor(10 * RESOURCE_PRECISION));
  });

  it("tx error: returns failure with extracted error", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockResolvedValue(
      defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS }),
    );
    (ctx.snapshot as any).tiles = [{ occupierId: 2, position: ADJACENT_EAST_POS }];

    (ctx.provider.troop_structure_adjacent_transfer as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("execution reverted: not enough resources"),
    );

    const result = await transferToStructure(
      { armyId: 1, structureId: 2, resources: [{ resourceId: 5, amount: 10 }] },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Transfer failed");
  });
});

describe("transferToArmy", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it("rejects empty resources", async () => {
    const result = await transferToArmy({ fromArmyId: 1, toArmyId: 2, resources: [] }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toBe("No resources specified.");
  });

  it("fromArmy not found → failure", async () => {
    const result = await transferToArmy(
      { fromArmyId: 99, toArmyId: 2, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("toArmy not found → failure", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      return null;
    });

    const result = await transferToArmy(
      { fromArmyId: 1, toArmyId: 99, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("armies not adjacent → failure", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: NON_ADJACENT_POS });
      return null;
    });

    const result = await transferToArmy(
      { fromArmyId: 1, toArmyId: 2, resources: [{ resourceId: 1, amount: 10 }] },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("not adjacent");
  });

  it("success: calls troop_troop_adjacent_transfer with scaled resources", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: ADJACENT_EAST_POS });
      return null;
    });

    const result = await transferToArmy(
      { fromArmyId: 1, toArmyId: 2, resources: [{ resourceId: 5, amount: 10 }] },
      ctx,
    );

    expect(result.success).toBe(true);
    const call = (ctx.provider.troop_troop_adjacent_transfer as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.from_troop_id).toBe(1);
    expect(call.to_troop_id).toBe(2);
    expect(call.resources[0].amount).toBe(Math.floor(10 * RESOURCE_PRECISION));
  });

  it("tx error: returns failure with extracted error", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: ADJACENT_EAST_POS });
      return null;
    });

    (ctx.provider.troop_troop_adjacent_transfer as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("execution reverted: insufficient balance"),
    );

    const result = await transferToArmy(
      { fromArmyId: 1, toArmyId: 2, resources: [{ resourceId: 5, amount: 10 }] },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Transfer failed");
  });
});

describe("transferTroops", () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it("fromArmy not found → failure", async () => {
    const result = await transferTroops({ fromArmyId: 99, toArmyId: 2, amount: 100 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("toArmy not found → failure", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      return null;
    });

    const result = await transferTroops({ fromArmyId: 1, toArmyId: 99, amount: 100 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("99");
    expect(result.message).toContain("not found");
  });

  it("armies not adjacent → failure", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: NON_ADJACENT_POS });
      return null;
    });

    const result = await transferTroops({ fromArmyId: 1, toArmyId: 2, amount: 100 }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain("not adjacent");
  });

  it("scales amount by RESOURCE_PRECISION", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: ADJACENT_EAST_POS });
      return null;
    });

    await transferTroops({ fromArmyId: 1, toArmyId: 2, amount: 50 }, ctx);

    const call = (ctx.provider.explorer_explorer_swap as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.count).toBe(Math.floor(50 * RESOURCE_PRECISION));
  });

  it("calls explorer_explorer_swap with correct params", async () => {
    (ctx.client.view.explorerInfo as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) return defaultExplorer({ entityId: 1, position: DEFAULT_EXPLORER_POS });
      if (id === 2) return defaultExplorer({ entityId: 2, position: ADJACENT_EAST_POS });
      return null;
    });

    const result = await transferTroops({ fromArmyId: 1, toArmyId: 2, amount: 50 }, ctx);

    expect(result.success).toBe(true);
    const call = (ctx.provider.explorer_explorer_swap as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.from_explorer_id).toBe(1);
    expect(call.to_explorer_id).toBe(2);
    expect(call.to_explorer_direction).toBeDefined();
    expect(call.count).toBe(Math.floor(50 * RESOURCE_PRECISION));
  });
});
