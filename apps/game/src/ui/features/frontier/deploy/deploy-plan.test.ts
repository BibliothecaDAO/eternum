import {
  computeTravelFoodCosts,
  readExpeditionRules,
  setBlockTimestampSource,
  spawnRing,
} from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { frontierDay } from "./deploy-fixture";
import { deployArmy, deployDirection, deployRange, previewDeploy, readDeployPlan } from "./deploy-plan";

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
    expect(plan.slots).toEqual({ used: 1, allowed: 3 });
    expect(plan.next).toEqual({ slot: 1, inherited: null });
    expect(plan.troops).toMatchObject({ type: TroopType.Knight, tier: TroopTier.T1, atHome: 420 });
    expect(plan.wheatPerTroop).toBe(2);
    expect(plan.wheat).toBe(1_000);
  });

  it("stops the slider at the troops at home, the castle's cap or the wheat, whichever comes first", () => {
    const { store, row } = frontierDay();
    const plan = planOf(store, row)!;
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
    const plan = { ...planOf(store, row)!, wheat: 1_000 };
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
      // On the ethereal plane: never in today's region, so its day has ended.
      {
        model: "TileOccupancy",
        key: "0x81",
        value: { game_id: 1, alt: true, col: 3, row: 4, entity_id: 80, category: 15, is_structure: false },
      },
      {
        model: "ArmyProgress",
        key: "0x82",
        value: {
          game_id: 1,
          explorer_id: 80,
          xp: 0,
          battle: 1,
          logistics: 1,
          scouting: 1,
          scouting_kinds: 0,
          homecoming: 4,
        },
      },
    ] as never);
    // An epic Homecoming returns 18% of its 100 whole troops.
    expect(planOf(store, row)!.troops!.atHome).toBe(438);
  });

  it("reads the tiers the training buildings start an army at, and the Rations mark", () => {
    const { store, row } = frontierDay();
    expect(planOf(store, row)).toMatchObject({ startingTiers: [1, 1, 1, 1], rations: false });
    // realm-research's layout: the Barracks row's tier in bits 14-16, its first choice at bit 17 (1 = Rations); the
    // War hall's tier in bits 24-26.
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: "0xd",
        value: { game_id: 1, structure_id: 7, learned: (1n << 14n) | (1n << 17n) | (2n << 24n) },
      },
    ] as never);
    expect(planOf(store, row)).toMatchObject({ startingTiers: [3, 1, 1, 1], rations: true });
  });

  it("starts a new army full at the Logistics its realm's Supply yard has trained", () => {
    const { store, row } = frontierDay();
    const max = () => previewDeploy(store, 1, planOf(store, row)!, 100, 3).stamina!;
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
    const troops = planOf(store, row)!.troops!;
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
