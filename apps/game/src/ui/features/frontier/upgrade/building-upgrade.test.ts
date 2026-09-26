import { afterEach, describe, expect, it } from "vitest";
import { markedPlot, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { realmBoard } from "../build/build-fixture";
import { readBuildingUpgradePlan } from "./building-upgrade";

const farmOn = (plot: { col: number; row: number }, tier: number) => ({
  building: {
    game_id: 1,
    structure_id: 7,
    inner_col: plot.col,
    inner_row: plot.row,
    category: BuildingType.ResourceWheat,
    paused: false,
    labor_paid: 0n,
    tier,
  },
  plot,
});

afterEach(() => setBlockTimestampSource(null));

describe("a building's upgrade", () => {
  it("offers the next tier only once the realm has researched it, at the tier's labor, doubled on the marked plot", () => {
    const { store, realm } = realmBoard();
    const plot = markedPlot(1, 1);
    const unresearched = readBuildingUpgradePlan(store, realm, farmOn(plot, 1), 3)!;
    expect(unresearched.next).toBeNull();
    expect(unresearched.doubled).toBe(true);

    store.applyFacts([
      { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned: 1 } },
    ] as never);
    const plan = readBuildingUpgradePlan(store, realm, farmOn(plot, 1), 3)!;
    expect(plan.now.tier).toBe(1);
    expect(plan.next?.tier).toBe(2);
    expect(plan.next!.gain.value).toBeCloseTo(plan.now.gain.value * 2, 6);
    expect(plan.price).toEqual([{ resource: ResourcesIds.Labor, amount: 200 }]);
    // The fixture realm holds 1,000 labor.
    expect(plan.affordable).toBe(true);
    // At the researched tier there is nothing further to upgrade to.
    expect(readBuildingUpgradePlan(store, realm, farmOn(plot, 2), 3)!.next).toBeNull();
  });
});
