import { expect, it } from "vitest";
import { buildArmyRestedNotification } from "./army-rested";
import { buildDayOpen } from "./day-open";
import { pushGameName } from "./game-name";
import { buildStoryNotification } from "./story-notification";

/** A game as its shard's directory lists it: the registry's name is an id no player should read. */
const devcon = { game_id: 1, name: "frontier-1793451600", mode: "frontier", season_number: 0 } as const;
const blitz = { game_id: 4, name: "blitz-1793455200", mode: "blitz", season_number: null } as const;
const ID_LIKE = /0x[\da-f]+|\d{5,}|(?:frontier|blitz)-/i;
const NOW = Date.UTC(2026, 10, 3, 8, 30);

it.each([
  [devcon, "Season 0"],
  [{ ...devcon, season_number: 1 }, "Season 1"],
  [blitz, "Blitz"],
  [{ mode: "eternum", season_number: null }, "Eternum"],
  [{ mode: "duel" }, "Duel"],
  [{ ...devcon, season_number: null }, "Frontier"],
  [{ ...devcon, season_number: undefined }, "Frontier"],
  [{ mode: null }, "Realms"],
  [undefined, "Realms"],
] as const)("names %o as players do: %s", (game, name) => {
  expect(pushGameName(game)).toBe(name);
});

it("never puts the registry's name or another id in a game push", () => {
  const alerts = [
    buildDayOpen({
      chainId: "0xa",
      worldAddress: "0x123",
      gameId: devcon.game_id,
      game: devcon,
      day: 1,
      opensAt: NOW,
      endsAt: NOW + 6 * 3_600_000,
      last: false,
      owner: "0x1",
      claim: { labor: 1000, essence: 1000 },
      sendAt: NOW,
      timeZone: "Asia/Kolkata",
    }),
    buildArmyRestedNotification({
      chainId: "0xa",
      gameId: devcon.game_id,
      fullAt: NOW,
      until: NOW + 3_600_000,
      armies: 2,
      owner: "0x1",
      game: devcon,
      now: NOW,
    })!,
    buildStoryNotification({
      sourceId: "story:v1:0xa:0x123:0x4:0xabc:0x64",
      value: { timestamp: String(NOW / 1000), story: { BlitzFinalized: {} } },
      owner: "0x1",
      game: blitz,
      target: "/g/0xa/4",
      now: NOW,
    })!,
  ];
  expect(alerts.map(({ title, body }) => `${title} / ${body}`)).toEqual([
    "Day 2 is open / Season 0: claim 1,000 Labor and 1,000 Essence before 20:00.",
    "Your armies are rested / Season 0: their stamina is full.",
    "Your Blitz is settled / Blitz: see where you finished.",
  ]);
  for (const { title, body } of alerts) expect(`${title} ${body}`).not.toMatch(ID_LIKE);
});
