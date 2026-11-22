import { seedScouts } from "@/lab/game/scouts-scenario";
import { computeExploreFoodCosts, setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frontierDay } from "./deploy-fixture";
import { deployArmy, deployDirection, deployRange, marchOn, previewDeploy, readDeployPlan } from "./deploy-plan";

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

const rangeOf = (plan: NonNullable<ReturnType<typeof planOf>>) => deployRange(plan, marchOn(plan.open[0]!.start!, 0));

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
    expect(rangeOf(plan)).toMatchObject({ troopsMax: Math.min(420, plan.troops!.cap) });
    expect(rangeOf({ ...plan, troops: { ...plan.troops!, cap: 300 } }).max).toBe(300);
    holdWheat(store, 100);
    expect(rangeOf(planOf(store, row)!)).toMatchObject({ wheatMax: 46, max: 46 });
    expect(rangeOf({ ...plan, troops: null }).max).toBe(0);
    expect(deployRange(plan, undefined).max).toBe(0);
  });

  it("sends only the whole troops the held wheat pays for", () => {
    const { store, row } = frontierDay();
    holdWheat(store, 8);
    const plan = planOf(store, row)!;
    expect(rangeOf(plan)).toMatchObject({ wheatMax: 3, max: 3 });
    expect(plan.raise!.wheatFor(4)).toBe(8);
    holdWheat(store, 4.5);
    expect(rangeOf(planOf(store, row)!).max).toBe(2);
  });

  it("previews the whole troops a count sends and the wheat they cost", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
    expect(previewDeploy(plan, marchOn(plan.open[0]!.start!, 0), 120.7)).toEqual({ count: 120, wheatCost: 240 });
  });

  it("keeps at Max the wheat the army burns revealing its whole bar, so it never leaves unable to take a step", () => {
    const { store, row } = frontierDay();
    holdWheat(store, 5_940);
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0x8",
        value: { game_id: 1, entity_id: 7, resource_type: 26, balance: String(2_970n * BigInt(RESOURCE_PRECISION)) },
      },
    ] as never);
    const plan = planOf(store, row)!;
    const bar = plan.open[0]!.start!;
    const reveals = Math.floor(bar.current / bar.perExplore);
    const range = deployRange(plan, marchOn(bar, 0));
    expect([reveals, range.troopsMax, range.max]).toEqual([7, 2_970, 2_775]);
    const left = plan.raise!.wheat - previewDeploy(plan, marchOn(bar, 0), range.max).wheatCost;
    const perReveal = (troops: number) =>
      computeExploreFoodCosts({ category: TroopType.Knight, count: BigInt(troops) * BigInt(RESOURCE_PRECISION) })
        .wheatPayAmount;
    expect(left).toBe(390);
    expect(left).toBeGreaterThanOrEqual(perReveal(range.max) * reveals);
    expect(plan.raise!.wheat - plan.raise!.wheatFor(range.max + 1)).toBeLessThan(perReveal(range.max + 1) * reveals);
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
  const march = marchOn(plan.open[0]!.start!, 0);
  expect(previewDeploy(plan, march, 400)).toEqual({ count: 400, wheatCost: 800 });
  expect(deployRange(plan, march).max).toBe(434);
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
