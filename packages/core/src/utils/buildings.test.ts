import { afterEach, expect, it, vi } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
// The package index first, so the config singleton the utils read through it is evaluated before any cost is read.
import { configManager, getBuildingCosts, setBuildingCount } from "..";

const REALM = 7;
const INCREASE_BPS = 2_500;
const BASE = 60;

// construction.cairo pay_building_costs, with `count` read after the new building is erected.
const chainCost = (base: number, countAfterErecting: number) => {
  const scale = countAfterErecting - 1;
  return base + scale * scale * ((base * INCREASE_BPS) / 10_000);
};

// Only the rows the cost reads: the realm's building counts, and the board rules when the game has a board.
const storeWith = (category: BuildingType, standing: number, board: boolean) => {
  const [packed_counts_1, packed_counts_2, packed_counts_3] = setBuildingCount(category, [0n, 0n, 0n], standing);
  const rows: Record<string, unknown> = {
    StructureBuildings: { packed_counts_1, packed_counts_2, packed_counts_3 },
    ...(board ? { BoardRules: {}, RealmKnowledge: { learned: 0 } } : {}),
  };
  return { get: (model: string) => rows[model] } as never;
};

const nextCost = (category: BuildingType, standing: number, board = false) =>
  getBuildingCosts(REALM, storeWith(category, standing, board), category, false)![0].amount;

afterEach(() => vi.restoreAllMocks());

it("charges the next building what the chain charges, for 0, 1 and 2 already standing", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getBuildingBaseCostPercentIncrease").mockReturnValue(INCREASE_BPS);
  vi.spyOn(configManager, "getBuildingCosts").mockReturnValue([{ resource: ResourcesIds.Wood, amount: BASE }]);

  expect([0, 1, 2].map((standing) => nextCost(BuildingType.ResourceWood, standing))).toEqual([
    chainCost(BASE, 1),
    chainCost(BASE, 2),
    chainCost(BASE, 3),
  ]);
  expect(nextCost(BuildingType.ResourceWood, 0)).toBe(BASE);
});

it("leaves the realm's own workshop out of the count on a realm board, as the chain does", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getBuildingBaseCostPercentIncrease").mockReturnValue(INCREASE_BPS);
  vi.spyOn(configManager, "getBuildingCosts").mockReturnValue([{ resource: ResourcesIds.Wood, amount: BASE }]);

  // The chain erects, then takes one off the workshop count before scaling.
  expect(nextCost(BuildingType.ResourceLabor, 1, true)).toBe(chainCost(BASE, 2 - 1));
  expect(nextCost(BuildingType.ResourceLabor, 2, true)).toBe(chainCost(BASE, 3 - 1));
  expect(nextCost(BuildingType.ResourceLabor, 2)).toBe(chainCost(BASE, 3));
});

it("adds each researched tier price once, without applying the building copy surcharge to upgrades", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getBuildingBaseCostPercentIncrease").mockReturnValue(INCREASE_BPS);
  vi.spyOn(configManager, "getBuildingCosts").mockReturnValue([{ resource: ResourcesIds.Labor, amount: 100 }]);
  const base = storeWith(BuildingType.ResourceWheat, 2, true) as { get: (model: string) => unknown };
  const facts = {
    get: (model: string) => (model === "RealmKnowledge" ? { learned: 3 } : base.get(model)),
    require: (model: string, keys: { node?: number; tier?: number }) => {
      if (model === "ResearchNode")
        return { effect: { BuildingTier: { 0: BuildingType.ResourceWheat, 1: keys.node === 0 ? 2 : 3 } } };
      if (model === "BuildingTierRule")
        return { labor_upgrade_cost: BigInt(keys.tier === 2 ? 200 : 400) * 1_000_000_000n };
      throw new Error(`Unexpected row ${model}`);
    },
  } as never;
  expect(getBuildingCosts(REALM, facts, BuildingType.ResourceWheat, true)).toEqual([
    { resource: ResourcesIds.Labor, amount: chainCost(100, 3) + 200 + 400 },
  ]);
});
