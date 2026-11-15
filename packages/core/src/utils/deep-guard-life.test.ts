import { expect, it } from "vitest";
import type { NativeFactStore } from "../client/native-fact-store";
import { dayOf } from "./days";
import { deepGuardLife } from "./deep-guard-life";

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
  const short = deepGuardLife(store, 1, 100n, now);
  expect(short).toMatchObject({ lossPerTick: 20n, ticksToEmpty: 5, ticksLeft: 5, ticksInDay: dayTicks });
  expect(short.secondsLeft).toBe(5 * tick);
  const long = deepGuardLife(store, 1, 20n * BigInt(dayTicks + 10), now);
  expect(long.ticksLeft).toBe(dayTicks);
  expect(long.secondsLeft).toBe(day.end - now);
  expect(deepGuardLife(store, 1, 101n, now).ticksToEmpty).toBe(6);
});
