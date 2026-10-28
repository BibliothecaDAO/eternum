import { dayOf } from "@bibliothecadao/eternum/expeditions";
import { fetchHeraldGameSnapshot } from "@bibliothecadao/eternum/game-client";
import { expect, it, vi } from "vitest";
import { planDayOpenings, readEnrolledAccounts, readHomeClaim, type DayOpenGame } from "./day-open";

// Mock only the network; decoding, the claim and the seeded schedule use the built public SDK.
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  fetchHeraldGameSnapshot: vi.fn(),
}));

const calendar = { seed: 0x5eedn, startMainAt: 1_800_000_000, dayUnitSeconds: 7_200 };
const game: DayOpenGame = {
  game_id: 1,
  name: "Devcon",
  mode: "frontier",
  status: "Live",
  clock: { start_main_at: calendar.startMainAt, end_at: calendar.startMainAt + 2 * 20 * calendar.dayUnitSeconds },
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
        gameName: "Devcon",
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

const PLAYER = "0x4b1d";
const realm = (entity: number, owner: string, realmId: number) => ({
  key: `0x${entity.toString(16)}`,
  value: {
    game_id: 1,
    entity_id: entity,
    owner,
    base: {
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      created_at: 1,
      category: 1,
      level: 0,
      starting_troops_granted: true,
    },
    resources_packed: "0x0",
    metadata: { realm_id: realmId, order: 0, has_wonder: false, village_realm: "0x0", mine_kind: 0, deepest_depth: 0 },
  },
});
const homeSnapshot = (rows: { SettledRealm?: unknown[]; CampaignHome?: unknown[] }) => ({
  confirmed_block: 10,
  game_id: "1",
  models: [
    { model: "Structure", rows: [realm(5, PLAYER, 711), realm(6, "0x7e1", 712)] },
    {
      model: "LaborRules",
      rows: [
        {
          key: "0x1",
          value: { game_id: 1, amount: 1000, campaign_essence: 1000, golden_amount: 2000, golden_essence: 2000 },
        },
      ],
    },
    { model: "SettledRealm", rows: rows.SettledRealm ?? [] },
    { model: "CampaignHome", rows: rows.CampaignHome ?? [] },
  ],
});
const campaignHome = (home: number, tier: number) => ({
  key: `0x${home.toString(16)}`,
  value: { game_id: 1, home, campaign_id: "0x646576636f6e2d32303236", tier },
});

it("reads what the player's own realm claims, as the Realm sheet reads it", async () => {
  const snapshot = vi.mocked(fetchHeraldGameSnapshot);
  snapshot.mockResolvedValueOnce(
    homeSnapshot({ SettledRealm: [{ key: "0x2c7", value: { game_id: 1, realm_id: 711, home: 5 } }] }) as never,
  );
  expect(await readHomeClaim("https://shard.test", 1, PLAYER)).toEqual({ labor: 1000, essence: 0 });
  expect(snapshot).toHaveBeenLastCalledWith(
    { url: "https://shard.test" },
    1,
    ["Structure", "SettledRealm", "CampaignHome", "LaborRules"],
    PLAYER,
    PLAYER,
  );
  snapshot.mockResolvedValueOnce(homeSnapshot({ CampaignHome: [campaignHome(5, 1)] }) as never);
  expect(await readHomeClaim("https://shard.test", 1, PLAYER)).toEqual({ labor: 1000, essence: 1000 });
  snapshot.mockResolvedValueOnce(homeSnapshot({ CampaignHome: [campaignHome(5, 2)] }) as never);
  expect(await readHomeClaim("https://shard.test", 1, PLAYER)).toEqual({ labor: 2000, essence: 2000 });
  // Another player's campaign home is not this player's claim.
  snapshot.mockResolvedValueOnce(homeSnapshot({ CampaignHome: [campaignHome(6, 2)] }) as never);
  expect(await readHomeClaim("https://shard.test", 1, PLAYER)).toBeNull();
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
