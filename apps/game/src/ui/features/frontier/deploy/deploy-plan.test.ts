import { computeTravelFoodCosts, setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frontierDay } from "./deploy-fixture";
import { deployArmy, deployDirection, deployRange, previewDeploy, readDeployPlan } from "./deploy-plan";

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("Frontier's deploy", () => {
  it("reads the troops at home as one count, the slot the next army fills, and the wheat each troop costs", () => {
    const { store, row } = frontierDay();
    const plan = readDeployPlan(store, row, 3)!;
    expect(plan.slots).toEqual({ used: 1, allowed: 3 });
    expect(plan.next).toEqual({ slot: 1, inherited: null });
    expect(plan.troops).toMatchObject({ type: TroopType.Knight, tier: TroopTier.T1, atHome: 420 });
    expect(plan.wheatPerTroop).toBe(2);
    expect(plan.wheat).toBe(1_000);
  });

  it("stops the slider at the troops at home, the castle's cap or the wheat, whichever comes first", () => {
    const { store, row } = frontierDay();
    const plan = readDeployPlan(store, row, 3)!;
    expect(deployRange({ ...plan, troops: { ...plan.troops!, cap: 10_000 } })).toEqual({
      troopsMax: 420,
      wheatMax: 500,
      max: 420,
    });
    expect(deployRange({ ...plan, troops: { ...plan.troops!, cap: 300 } }).max).toBe(300);
    expect(deployRange({ ...plan, wheat: 100 })).toMatchObject({ wheatMax: 50, max: 50 });
    expect(deployRange({ ...plan, troops: null }).max).toBe(0);
  });

  it("previews the wheat a count costs, the wheat left and the tiles it moves the army", () => {
    const { store, row } = frontierDay();
    const plan = { ...readDeployPlan(store, row, 3)!, wheat: 1_000 };
    const preview = previewDeploy(store, 1, { ...plan, troops: { ...plan.troops!, cap: 10_000 } }, 120, 3);
    const perTile = Math.abs(
      computeTravelFoodCosts({ category: TroopType.Knight, count: BigInt(RESOURCE_PRECISION) }).wheatPayAmount,
    );
    expect(preview.count).toBe(120);
    expect(preview.wheatCost).toBe(240);
    expect(preview.wheatLeft).toBe(760);
    expect(preview.tiles).toBe(Math.floor(760 / (120 * perTile)));
    expect(preview.stamina?.max).toBeGreaterThan(0);
    // No depth rules loaded: the yield is unknown, never zero.
    expect(preview.revealYield).toBeUndefined();
  });

  it("starts a new army full at the Logistics its realm's Supply yard has trained", () => {
    const { store, row } = frontierDay();
    const max = () => previewDeploy(store, 1, readDeployPlan(store, row, 3)!, 100, 3).stamina!;
    expect(max()).toEqual({ amount: 150, max: 150 });
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
    const taken = open.map((tile, index) => (index === 3 ? { ...tile, open: false } : tile));
    expect(deployDirection(taken, open[3].direction)).toBe(open[0].direction);
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

  it("sends Deploy with the count and the direction", async () => {
    const { store, row } = frontierDay();
    const troops = readDeployPlan(store, row, 3)!.troops!;
    const createExplorerArmy = vi.fn(() => Promise.resolve());
    await deployArmy({ createExplorerArmy }, row, troops, 120, 2);
    expect(createExplorerArmy).toHaveBeenCalledWith({
      structureId: 7,
      troopType: TroopType.Knight,
      troopTier: TroopTier.T1,
      troopCount: 120,
      spawnDirection: 2,
    });
  });
});
