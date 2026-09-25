import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frontierDay } from "./muster-fixture";
import { musterArmy, musterDirection, musterMaximum, previewMuster, readMusterPlan } from "./muster-plan";

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("Frontier's muster", () => {
  it("offers only the troops the realm holds, and the slot the next army fills", () => {
    const { store, row } = frontierDay();
    const plan = readMusterPlan(store, row, 3)!;
    expect(plan.slots).toEqual({ used: 1, allowed: 3 });
    expect(plan.next).toEqual({ slot: 1, inherited: null });
    expect(plan.stacks.map(({ type, tier, available }) => ({ type, tier, available }))).toEqual([
      { type: TroopType.Knight, tier: TroopTier.T1, available: 420 },
    ]);
    expect(musterMaximum({ ...plan.stacks[0], cap: 300 })).toBe(300);
  });

  it("previews the army a count makes, never past what the realm can field", () => {
    const { store, row } = frontierDay();
    const plan = readMusterPlan(store, row, 3)!;
    const stack = plan.stacks[0];
    const preview = previewMuster(store, 1, plan, stack, 10_000, 3);
    expect(preview.count).toBe(musterMaximum(stack));
    expect(preview.stamina?.max).toBeGreaterThan(0);
    // No depth rules loaded: the yield is unknown, never zero.
    expect(preview.revealYield).toBeUndefined();
  });

  it("steps out on the first explored open hex around the realm, and nowhere while the ring is unknown or taken", () => {
    const { store, row } = frontierDay();
    expect(musterDirection(store, row, () => 0)).not.toBeNull();
    expect(musterDirection(store, row, () => undefined)).toBeNull();
    expect(musterDirection(store, row, () => 1)).toBeNull();
  });

  it("musters the chosen stack and count in the given direction", async () => {
    const { store, row } = frontierDay();
    const stack = readMusterPlan(store, row, 3)!.stacks[0];
    const createExplorerArmy = vi.fn(() => Promise.resolve());
    await musterArmy({ createExplorerArmy }, row, stack, 120, 2);
    expect(createExplorerArmy).toHaveBeenCalledWith({
      structureId: 7,
      troopType: TroopType.Knight,
      troopTier: TroopTier.T1,
      troopCount: 120,
      spawnDirection: 2,
    });
  });
});
