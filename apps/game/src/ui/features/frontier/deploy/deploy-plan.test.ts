import { seedScouts } from "@/lab/game/scouts-scenario";
import { setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
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

/** The deploy plan at the fixture's moment: t=350, default tick 3. */
const planOf = (store: Parameters<typeof readDeployPlan>[0], row: Parameters<typeof readDeployPlan>[1]) =>
  readDeployPlan(store, row, { now: 350, defaultTick: 3 });

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("Frontier's deploy", () => {
  it("reads the troops at home as one count, the slot the next army fills, and the wheat each troop costs", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    expect(plan.open[0]).toEqual({
      slot: 1,
      number: 2,
      inherited: false,
      start: { current: 150, max: 150, perExplore: 20 },
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

  it("sends only the whole troops the held wheat pays for", () => {
    const { store, row } = frontierDay();
    holdWheat(store, 8);
    const plan = planOf(store, row)!;
    expect(deployRange(plan)).toMatchObject({ wheatMax: 4, max: 4 });
    expect(plan.raise!.wheatFor(4)).toBe(8);
    holdWheat(store, 4.5);
    expect(deployRange(planOf(store, row)!).max).toBe(2);
  });

  it("previews the whole troops a count sends and the wheat they cost", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    expect(previewDeploy(plan, 120.7)).toEqual({ count: 120, wheatCost: 240 });
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

it("selects Scouts from their own stock, price and Scouting bar without taking Knights", () => {
  const { store, row } = frontierDay();
  seedScouts(store);
  const plan = readDeployPlan(store, row, { now: 350, defaultTick: 3 }, TroopType.Paladin)!;
  expect(plan.choices.map(({ type, atHome }) => ({ type, atHome }))).toEqual([
    { type: TroopType.Knight, atHome: 420 },
    { type: TroopType.Paladin, atHome: 600 },
  ]);
  expect(plan.troops).toMatchObject({ type: TroopType.Paladin, atHome: 600 });
  expect(plan.open[0]?.start).toEqual({ current: 150, max: 150, perExplore: 10 });
  expect(previewDeploy(plan, 400)).toEqual({ count: 400, wheatCost: 800 });
  expect(deployRange(plan).max).toBe(500);
  const actions = { createExplorerArmy: vi.fn() };
  deployArmy(actions, row, plan.troops!, 400, 0, 1);
  expect(actions.createExplorerArmy).toHaveBeenCalledWith({
    structureId: 7,
    troopType: TroopType.Paladin,
    troopTier: TroopTier.T1,
    troopCount: 400,
    spawnDirection: 0,
    slot: 1,
  });
});
