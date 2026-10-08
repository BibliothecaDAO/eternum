import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frontierDay } from "./muster-fixture";
import { spawnRing } from "@bibliothecadao/eternum";
import { deployDirection, musterArmy, musterMaximum, previewMuster, readMusterPlan } from "./muster-plan";

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

  it("starts a new army full at the Logistics its realm's Supply yard has trained", () => {
    const { store, row } = frontierDay();
    const max = () => {
      const plan = readMusterPlan(store, row, 3)!;
      return previewMuster(store, 1, plan, plan.stacks[0], 100, 3).stamina!;
    };
    const untrained = max();
    expect(untrained).toEqual({ amount: 150, max: 150 });
    // research.cairo: the Supply yard's tier at bit 27; two tiers trained.
    store.applyFacts([
      { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: 2n << 27n } },
    ] as never);
    expect(max()).toEqual({ amount: 200, max: 200 });
  });

  it("deploys onto the picked tile while it stays open, else the first open one, never onto unknown or taken ground", () => {
    const { store, row } = frontierDay();
    const ring = (occupier: (col: number) => number | undefined) => spawnRing(store, row, (hex) => occupier(hex.col));
    const open = ring(() => 0);
    expect(open).toHaveLength(6);
    expect(deployDirection(open, null)).toBe(open[0].direction);
    expect(deployDirection(open, open[3].direction)).toBe(open[3].direction);
    // The picked tile is taken: the army falls back to the first open tile.
    const taken = open.map((tile, index) => (index === 3 ? { ...tile, open: false } : tile));
    expect(deployDirection(taken, open[3].direction)).toBe(open[0].direction);
    // Unknown ground (an unexplored ring) and a ring all taken give no tile.
    expect(
      deployDirection(
        ring(() => undefined),
        null,
      ),
    ).toBeNull();
    expect(
      deployDirection(
        ring(() => 1),
        null,
      ),
    ).toBeNull();
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
