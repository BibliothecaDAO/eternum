import { dayOf } from "@bibliothecadao/eternum/expeditions";
import { fetchHeraldGameSnapshot } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it, vi } from "vitest";
import { planDayEndReminders, readReminderPlayers, type ReminderGame } from "./day-end-reminder";

// Exercise the shared source mirror; planner tests do not read a live shard or depend on SDK build artifacts.
vi.mock("@bibliothecadao/eternum/expeditions", () => import("../../../packages/core/src/utils/days"));
vi.mock("@bibliothecadao/eternum/game-client", async () => ({
  fetchHeraldGameSnapshot: vi.fn(),
  NativeFactStore: (await import("../../../packages/core/src/client/native-fact-store")).NativeFactStore,
}));
// Enrollment decoding uses the real store; tile positioning and expedition scope are unrelated to this snapshot.
vi.mock("../../../packages/core/src/client/native-occupancy", () => ({ hasSingleTilePosition: vi.fn() }));
vi.mock("../../../packages/core/src/utils/expeditions", () => ({ readExpeditionRules: vi.fn() }));

const calendar = { seed: 0x5eedn, startMainAt: 1_800_000_000, dayUnitSeconds: 14_400 };
const game: ReminderGame = {
  game_id: 1,
  name: "Frontier",
  mode: "frontier",
  status: "Live",
  clock: { start_main_at: calendar.startMainAt, end_at: calendar.startMainAt + 21 * 20 * calendar.dayUnitSeconds },
  expedition: { seed: calendar.seed.toString(), day_unit_seconds: calendar.dayUnitSeconds },
};

const days = () => {
  const result = [];
  let start = calendar.startMainAt;
  for (let index = 0; index < 5; index++) {
    const day = dayOf(calendar, start)!;
    result.push(day);
    start = day.end;
  }
  return result;
};

it("reads confirmed enrollment for all owners, rather than activity or the entry's player address", async () => {
  vi.mocked(fetchHeraldGameSnapshot).mockResolvedValue({
    confirmed_block: 10,
    game_id: "1",
    models: [
      {
        model: "PlayerEntry",
        rows: [
          { key: "0x1", value: { game_id: 1, owner: "0x01", player: "0xdead" } },
          { key: "0x2", value: { game_id: 1, owner: "0x02", player: "0xbeef" } },
        ],
      },
    ],
  });
  expect(await readReminderPlayers("https://shard.test", 1)).toEqual(["0x1", "0x2"]);
  expect(fetchHeraldGameSnapshot).toHaveBeenLastCalledWith({ url: "https://shard.test" }, 1, ["PlayerEntry"]);
});

it("rejects missing enrollment or a snapshot of another game", async () => {
  vi.mocked(fetchHeraldGameSnapshot).mockResolvedValue({ confirmed_block: 10, game_id: "1", models: [] });
  await expect(readReminderPlayers("https://shard.test", 1)).rejects.toThrow("omitted PlayerEntry");
  vi.mocked(fetchHeraldGameSnapshot).mockResolvedValue({ confirmed_block: 10, game_id: "2", models: [] });
  await expect(readReminderPlayers("https://shard.test", 1)).rejects.toThrow("another game");
});

describe("rule 9.6: the shared seeded day supplies the reminder instant", () => {
  it.each([8, 12, 24])("prepares the %i-hour day's reminder for exactly end minus 3600", (hours) => {
    const day = days().find((candidate) => candidate.end - candidate.start === hours * 3600)!;
    const dueAt = (day.end - 3600) * 1000;
    const plan = planDayEndReminders([game], dueAt - 500, 1000);
    expect(plan.prepare).toEqual([expect.objectContaining({ gameId: 1, day: day.index, dueAt, endsAt: day.end })]);
    expect(plan.nextAlarmAt).toBe(dueAt);
    expect(plan.prepare[0]!.tomorrowSeconds).toBe(dayOf(calendar, day.end)!.end - day.end);
  });

  it("a day ending at 05:40 schedules 04:40, without a timezone or quiet-hours rule", () => {
    const end = Date.parse("2026-10-08T05:40:00Z") / 1000;
    const firstLength = dayOf({ ...calendar, startMainAt: 0 }, 0)!.end;
    const shifted = { ...game, clock: { ...game.clock, start_main_at: end - firstLength } };
    const dueAt = Date.parse("2026-10-08T04:40:00Z");
    expect(planDayEndReminders([shifted], dueAt - 500, 1000).prepare[0]!.dueAt).toBe(dueAt);
  });

  it("does not reconstruct a reminder once the scheduled hour has passed", () => {
    const day = days()[0]!;
    const dueAt = (day.end - 3600) * 1000;
    expect(planDayEndReminders([game], dueAt, 1000).prepare).toEqual([]);
    expect(planDayEndReminders([game], dueAt + 1000, 1000).prepare).toEqual([]);
    expect(planDayEndReminders([game], day.end * 1000 - 1, 1000).prepare).toEqual([]);
  });

  it("uses the existing alarm to prepare before the moment, not on every poll of the day", () => {
    const dueAt = (days()[0]!.end - 3600) * 1000;
    expect(planDayEndReminders([game], calendar.startMainAt * 1000, 1000)).toEqual({
      prepare: [],
      nextAlarmAt: dueAt - 1000,
    });
  });

  it("never schedules another format or a finished season", () => {
    const dueAt = (days()[0]!.end - 3600) * 1000;
    expect(planDayEndReminders([{ ...game, mode: "blitz" }], dueAt - 500, 1000).prepare).toEqual([]);
    expect(planDayEndReminders([{ ...game, status: "Settled" }], dueAt - 500, 1000).prepare).toEqual([]);
    expect(planDayEndReminders([game], game.clock.end_at * 1000, 1000).prepare).toEqual([]);
  });

  it("rejects missing calendar facts instead of inventing a 24-hour day", () => {
    expect(() => planDayEndReminders([{ ...game, expedition: null }], calendar.startMainAt * 1000, 1000)).toThrow(
      "calendar",
    );
  });
});
