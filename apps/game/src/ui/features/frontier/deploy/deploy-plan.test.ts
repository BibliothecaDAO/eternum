import { readExpeditionRules, setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { frontierDay } from "./deploy-fixture";
import { deployArmy, deployDirection, deployRange, previewDeploy, readDeployPlan } from "./deploy-plan";

/** The realm's wheat set to this much, at the chain's precision. */
const holdWheat = (store: Parameters<typeof readDeployPlan>[0], wheat: number) =>
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: "0xc",
      value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(Math.round(wheat * 1_000_000_000)) },
    },
  ] as never);

/** One Rations pick on the Barracks row, a quarter wheat off each troop's 2: a knight raises for 1.75 wheat. */
const withOneRations = (store: Parameters<typeof readDeployPlan>[0]) => {
  const board = store.require("BoardRules", { game_id: 1 });
  store.applyFacts([
    { model: "BoardRules", key: "0xa", value: { ...board, ration_step: "250000000" } },
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: 7, learned: String((1n << 14n) | (1n << 17n)) },
    },
  ] as never);
};

/** The deploy plan at the fixture's moment: t=350, default tick 3. */
const planOf = (store: Parameters<typeof readDeployPlan>[0], row: Parameters<typeof readDeployPlan>[1]) =>
  readDeployPlan(store, row, readExpeditionRules(store, 1)!, { now: 350, defaultTick: 3 });

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("Frontier's deploy", () => {
  it("reads the troops at home as one count, the slot the next army fills, and the wheat each troop costs", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    // The fixture's preset explores for 30 stamina: a 150 bar is five explores.
    expect(plan.open[0]).toEqual({
      slot: 1,
      number: 2,
      inherited: false,
      start: { current: 150, max: 150, perExplore: 30 },
    });
    expect(plan.troops).toMatchObject({ type: TroopType.Knight, tier: TroopTier.T1, atHome: 420 });
    expect(plan.raise!.wheatFor(1)).toBe(2);
    expect(plan.raise!.wheat).toBe(1_000);
  });

  it("caps the count at the troops at home, the castle's cap or the wheat, whichever comes first", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    expect(deployRange(plan)).toMatchObject({ troopsMax: Math.min(420, plan.troops!.cap) });
    expect(deployRange({ ...plan, troops: { ...plan.troops!, cap: 300 } }).max).toBe(300);
    holdWheat(store, 100);
    expect(deployRange(planOf(store, row)!)).toMatchObject({ wheatMax: 50, max: 50 });
    expect(deployRange({ ...plan, troops: null }).max).toBe(0);
  });

  it("prices the whole batch with Rations' cut, from the wheat held to the unit: never one troop's price rounded", () => {
    const { store, row } = frontierDay();
    withOneRations(store);
    holdWheat(store, 7);
    const plan = planOf(store, row)!;
    expect(deployRange(plan)).toMatchObject({ wheatMax: 4, max: 4 });
    expect(plan.raise!.wheatFor(4)).toBe(7);
    holdWheat(store, 3.5);
    expect(deployRange(planOf(store, row)!).max).toBe(2);
  });

  it("previews the whole troops a count sends and the wheat they cost", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    expect(previewDeploy(plan, 120.7)).toEqual({ count: 120, wheatCost: 240 });
  });

  it("counts Homecoming's return from an army whose day has ended among the troops this deploy finds", () => {
    const { store, row } = frontierDay();
    expect(planOf(store, row)!.troops!.atHome).toBe(420);
    store.applyFacts([
      {
        model: "ExplorerTroops",
        key: "0x80",
        value: {
          game_id: 1,
          explorer_id: 80,
          owner: 7,
          troops: { ...rowFixture.expected.value.troops, count: String(100n * 1_000_000_000n) },
        },
      },
      { model: "ArmyDay", key: "0x8d", value: { game_id: 1, explorer_id: 80, day: "0" } },
      {
        model: "TileOccupancy",
        key: "0x81",
        value: { game_id: 1, alt: true, col: 3, row: 4, entity_id: 80, category: 15, is_structure: false },
      },
      {
        model: "ArmyProgress",
        key: "0x82",
        value: {
          common_points: 0,
          uncommon_points: 0,
          rare_points: 0,
          epic_points: 0,
          legendary_points: 0,
          game_id: 1,
          explorer_id: 80,
          xp: 0,
          battle: 1,
          logistics: 1,
          scouting: 0,
          scouting_kinds: 0,
          homecoming: 4,
        },
      },
    ] as never);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 450 });
    // Day 0 has ended. Epic Homecoming returns 21% of its 100 whole troops.
    const tomorrow = readDeployPlan(store, row, readExpeditionRules(store, 1)!, { now: 450, defaultTick: 4 });
    expect(tomorrow!.troops!.atHome).toBe(441);
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
    const troops = planOf(store, row)!.troops!;
    const createExplorerArmy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" } as never));
    await deployArmy({ createExplorerArmy }, row, troops, 120, 2, 2);
    expect(createExplorerArmy).toHaveBeenCalledWith({
      structureId: 7,
      troopType: TroopType.Knight,
      troopTier: TroopTier.T1,
      troopCount: 120,
      spawnDirection: 2,
      slot: 2,
    });
  });
});
