import { expect, it } from "vitest";
import { nativeOathConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { dayOf } from "./days";
import { armyDrain, deepArmyLife } from "./deep-army-life";
import { oathBit } from "./oaths";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

const start = 1_800_000_000;
const calendar = {
  seed: 42n,
  startMainAt: start,
  scheduledEndAt: start + 10 * 14_400,
  endAt: start + 10 * 14_400,
  dayUnitSeconds: 14_400,
};
const tick = 600;
const rows: Record<string, unknown> = {
  DeepRules: { loss_per_tick: 20n },
  ArmyProgress: { oaths: 0 },
  SliceRules: { day_unit_seconds: 14_400, tick_config: { armies_tick_in_seconds: tick } },
  GameRegistry: {
    start_main_at: start,
    end_at: calendar.endAt,
    scheduled_end_at: calendar.scheduledEndAt,
    seed: calendar.seed,
  },
  SettlementRules: { spacing: 1024 },
};
const store = {
  get: (model: string) => rows[model],
  require: (model: string) => rows[model],
} as unknown as NativeFactStore;

it("holds for the troops' ticks when they run out before the day, else to the day's end", () => {
  const day = dayOf(calendar, start)!;
  const now = day.start;
  const dayTicks = (day.end - day.start) / tick;
  const short = deepArmyLife(store, army(1, 100n), now);
  expect(short).toMatchObject({ lossPerTick: 20n, ticksToEmpty: 5, ticksLeft: 5, ticksInDay: dayTicks });
  expect(short.secondsLeft).toBe(5 * tick);
  const long = deepArmyLife(store, army(1, 20n * BigInt(dayTicks + 10)), now);
  expect(long.ticksLeft).toBe(dayTicks);
  expect(long.secondsLeft).toBe(day.end - now);
  expect(deepArmyLife(store, army(1, 101n), now).ticksToEmpty).toBe(6);
});

/** Armies keyed by explorer: the facts an army's place in the Deep leaves, as the native store holds them. */
const armies = (held: { field: number[]; count: bigint; lastTick: number }) => {
  const keyed: Record<string, Record<number, unknown>> = {
    DeepArmy: Object.fromEntries(held.field.map((id) => [id, { last_tick: BigInt(held.lastTick) }])),
    ArmyProgress: Object.fromEntries([1, 2, 3].map((id) => [id, { oaths: 0 }])),
    ArmyDay: Object.fromEntries([1, 2, 3].map((id) => [id, { day: 0n }])),
    ExplorerTroops: Object.fromEntries(
      [1, 2, 3].map((id) => [id, { game_id: 1, explorer_id: BigInt(id), troops: { count: held.count } }]),
    ),
  };
  return {
    get: (model: string, key: { explorer_id?: bigint }) =>
      key.explorer_id === undefined ? rows[model] : keyed[model]?.[Number(key.explorer_id)],
    require: (model: string) => rows[model],
  } as unknown as NativeFactStore;
};
const army = (id: number, count: bigint) =>
  ({ game_id: 1, explorer_id: BigInt(id), troops: { count } }) as NativeRows["ExplorerTroops"];

it("drains an army waiting in the field of the Deep exactly as its attrition says, with its ticks left", () => {
  const first = Math.floor(start / tick);
  const field = armies({ field: [1], count: 100n, lastTick: first });
  expect(armyDrain(field, army(1, 100n), start)).toMatchObject({ lossPerTick: 20n, ticksToEmpty: 5, ticksLeft: 5 });
  // Two ticks on, 40 of its 100 troops are gone: 60 left, three ticks, exactly the configured loss.
  const later = armyDrain(field, army(1, 100n), start + 2 * tick);
  expect(later).toMatchObject({ ticksToEmpty: 3, ticksLeft: 3 });
  expect(later!.secondsLeft).toBe(3 * tick);
  // Five ticks on, none is left and no tick remains.
  expect(armyDrain(field, army(1, 100n), start + 5 * tick)).toMatchObject({ ticksToEmpty: 0, ticksLeft: 0 });
});

it("drains no army that stands above the Deep", () => {
  const above = armies({ field: [1], count: 100n, lastTick: 0 });
  expect(armyDrain(above, army(3, 100n), start)).toBeUndefined();
});

it("stacks Vitriol and Antidote additively up to 75% until expiry, then resumes Vitriol drain", () => {
  const first = Math.floor(start / tick);
  const vitriol = oathBit(nativeOathConstants.VITRIOL);
  const localRows: Record<string, unknown> = {
    ...rows,
    DeepRules: { loss_per_tick: 200n },
  };
  const keyed: Record<string, Record<number, unknown>> = {
    DeepArmy: { 1: { last_tick: BigInt(first) }, 2: { last_tick: BigInt(first) } },
    ArmyProgress: { 1: { oaths: vitriol }, 2: { oaths: vitriol } },
    ArmyDay: { 1: { day: 0n }, 2: { day: 0n } },
    ExplorerTroops: {
      1: { game_id: 1, explorer_id: 1n, troops: { count: 340n } },
      2: { game_id: 1, explorer_id: 2n, troops: { count: 200n } },
    },
    ArmyRelicEffect: {
      1: { rank: 3, expires_at: BigInt((first + 2) * tick) },
      2: { rank: 5, expires_at: BigInt((first + 4) * tick) },
    },
  };
  const customStore = {
    get: (model: string, key: { explorer_id?: bigint }) =>
      key.explorer_id === undefined ? localRows[model] : keyed[model]?.[Number(key.explorer_id)],
    require: (model: string) => localRows[model],
  } as unknown as NativeFactStore;

  const atStart = armyDrain(customStore, army(1, 340n), start)!;
  expect(atStart.lossPerTick).toBe(70n);
  expect(atStart.ticksToEmpty).toBe(4);
  expect(atStart.breakdown).toMatchObject({
    baseLossPerTick: 200n,
    vitriolActive: true,
    afterVitriolPerTick: 100n,
    antidoteRank: 3,
    antidoteReductionPercent: 15,
    lossPerTick: 70n,
  });

  const atMaxStack = armyDrain(customStore, army(2, 200n), start)!;
  expect(atMaxStack.lossPerTick).toBe(50n);
  expect(atMaxStack.ticksToEmpty).toBe(4);

  const afterThreeTicks = armyDrain(customStore, army(1, 340n), start + 3 * tick)!;
  expect(afterThreeTicks.lossPerTick).toBe(100n);
  expect(afterThreeTicks.ticksToEmpty).toBe(1);
});
