import { dayOf } from "@bibliothecadao/eternum/expeditions";
import { fetchHeraldGameSnapshot } from "@bibliothecadao/eternum/game-client";
import { expect, it, vi } from "vitest";
import { planDayOpenings, readEnrolledAccounts, type DayOpenGame } from "./day-open";

// Mock only the network; decoding, the claim and the seeded schedule use the built public SDK.
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  fetchHeraldGameSnapshot: vi.fn(),
}));

const calendar = {
  seed: 0x5eedn,
  startMainAt: 1_800_000_000,
  scheduledEndAt: 1_800_000_000 + 2 * 20 * 7_200,
  endAt: 1_800_000_000 + 2 * 20 * 7_200,
  dayUnitSeconds: 7_200,
};
const game: DayOpenGame = {
  game_id: 1,
  mode: "frontier",
  status: "Live",
  clock: {
    start_main_at: calendar.startMainAt,
    scheduled_end_at: calendar.startMainAt + 2 * 20 * calendar.dayUnitSeconds,
    end_at: calendar.startMainAt + 2 * 20 * calendar.dayUnitSeconds,
  },
  expedition: { seed: calendar.seed.toString(), day_unit_seconds: calendar.dayUnitSeconds },
};
const days = () => {
  const result = [dayOf(calendar, calendar.startMainAt)!];
  while (result.at(-1)!.end < game.clock.end_at) result.push(dayOf(calendar, result.at(-1)!.end)!);
  return result;
};

it("prepares the next day a minute before it opens, and wakes then", () => {
  const [, second] = days();
  const opensAt = second!.start * 1000;
  expect(planDayOpenings([game], opensAt - 120_000, 60_000)).toEqual({ prepare: [], nextAlarmAt: opensAt - 60_000 });
  expect(planDayOpenings([game], opensAt - 30_000, 60_000)).toEqual({
    prepare: [
      {
        gameId: 1,
        game: { mode: "frontier" },
        day: 1,
        opensAt,
        endsAt: second!.end * 1000,
        last: false,
      },
    ],
    nextAlarmAt: opensAt,
  });
});

it("opens Day 1 at the season's start, and names the last day with the season's end", () => {
  const start = calendar.startMainAt * 1000;
  expect(planDayOpenings([game], start - 10_000, 60_000).prepare[0]).toMatchObject({ day: 0, opensAt: start });
  const last = days().at(-1)!;
  const plan = planDayOpenings([game], last.start * 1000 - 10_000, 60_000);
  expect(plan.prepare[0]).toMatchObject({
    day: last.index,
    last: true,
    endsAt: Math.min(last.end, game.clock.end_at) * 1000,
  });
  // After the last day opens there is none to prepare.
  expect(planDayOpenings([game], last.start * 1000 + 1000, 60_000)).toEqual({ prepare: [], nextAlarmAt: null });
});

it("prepares nothing for Blitz or a settled game, and refuses a Frontier game without its calendar", () => {
  const opensAt = days()[1]!.start * 1000;
  expect(planDayOpenings([{ ...game, mode: "blitz" }], opensAt - 500, 60_000).prepare).toEqual([]);
  expect(planDayOpenings([{ ...game, status: "Settled" }], opensAt - 500, 60_000).prepare).toEqual([]);
  expect(() => planDayOpenings([{ ...game, expedition: null }], opensAt - 500, 60_000)).toThrow("no Frontier calendar");
});

it("reads confirmed enrollment for all owners, rather than activity or the entry's player address", async () => {
  vi.mocked(fetchHeraldGameSnapshot).mockResolvedValueOnce({
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
  } as never);
  expect(await readEnrolledAccounts("https://shard.test", 1)).toEqual(["0x1", "0x2"]);
});

it.each([81, 84, 85])("opens the actual final day of an %ih season and never prepares another", (hours) => {
  const end = calendar.startMainAt + hours * 3600;
  const lastStart = calendar.startMainAt + (hours === 81 ? 68 : 80) * 3600;
  const partial = { ...game, clock: { ...game.clock, end_at: end, scheduled_end_at: end } };
  expect(planDayOpenings([partial], lastStart * 1000 - 10_000, 60_000).prepare).toEqual([
    {
      gameId: 1,
      game: { mode: "frontier" },
      day: hours === 81 ? 9 : 10,
      opensAt: lastStart * 1000,
      endsAt: end * 1000,
      last: true,
    },
  ]);
  for (const at of [lastStart, end - 1, end, end + 1])
    expect(planDayOpenings([partial], at * 1000, 60_000)).toEqual({ prepare: [], nextAlarmAt: null });
});
