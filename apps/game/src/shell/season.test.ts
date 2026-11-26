// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { DirectoryGame } from "./herald";
import { directoryDay, endedSeasons, isAccelerated, seasonTitle } from "./season";
import { chooseSeason, hasSeasonRealm, isRehearsal, seasonRealm } from "./season-pick";
import { ARCHIVED_SEASONS } from "./season-tab/archive/archive";
import { PLAY_WORDS } from "@/ui/design-system/kit/words";

const season = (gameId: number, startMainAt: number, ownRealm: boolean): DirectoryGame => ({
  dev_mode_on: false,
  clock_scale: 1,
  expedition: null,
  name: `frontier-${gameId}`,
  player_count: ownRealm ? 1 : 0,
  registration: null,
  settlement: null,
  settled_realms_count: ownRealm ? 1 : 0,
  settled_villages_count: 0,
  chainId: "0xa",
  game_id: gameId,
  mode: "frontier",
  status: "Live",
  clock: {
    start_settling_at: 0,
    start_main_at: startMainAt,
    scheduled_end_at: 9_000_000_000,
    end_at: 9_000_000_000,
  },
  player_state: {
    registered: ownRealm,
    settled: ownRealm,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    fragments: null,
    ancient_seal: false,
    structures: ownRealm
      ? [
          {
            entity_id: 1,
            category: 1,
            level: 1,
            realm_id: 7,
            coord_x: 0,
            coord_y: 0,
            resources_packed: "0",
            aspect: null,
            has_wonder: false,
            realm_skin: 0,
          },
        ]
      : [],
  },
});

describe("the season a screen shows", () => {
  it("is the player's own, the latest to start among several, whatever the directory's order", () => {
    const early = season(1, 1_790_410_020, true);
    const late = season(2, 1_790_411_708, true);
    expect(chooseSeason([early, late], true)?.game_id).toBe(2);
    expect(chooseSeason([late, early], true)?.game_id).toBe(2);
  });

  it("is the latest live season for nobody, then the lowest game id at the same start", () => {
    expect(chooseSeason([season(4, 100, false), season(3, 100, false), season(5, 50, false)], false)?.game_id).toBe(3);
    expect(chooseSeason([season(9, 100, true), season(8, 200, false)], false)?.game_id).toBe(8);
  });

  it("returns null, never undefined, and reports false from hasSeasonRealm when a game has no player realm", () => {
    const nonRealm = {
      player_state: {
        ...season(1, 100, false).player_state!,
        structures: [
          {
            entity_id: 2,
            category: 5,
            level: 1,
            realm_id: 0,
            coord_x: 0,
            coord_y: 0,
            resources_packed: "0",
            aspect: null,
            has_wonder: false,
            realm_skin: 0,
          },
        ],
      },
    };
    expect(seasonRealm({ player_state: null })).toBeNull();
    expect(seasonRealm(season(1, 100, false))).toBeNull();
    expect(seasonRealm(nonRealm)).toBeNull();
    expect(seasonRealm(season(1, 100, true))?.realm_id).toBe(7);

    expect(hasSeasonRealm({ player_state: null })).toBe(false);
    expect(hasSeasonRealm(season(1, 100, false))).toBe(false);
    expect(hasSeasonRealm(nonRealm)).toBe(false);
    expect(hasSeasonRealm(season(1, 100, true))).toBe(true);
  });
});

it("never picks a testnet game as the season, however late it started, at whatever speed, or whoever holds a realm in it", () => {
  const playtest = season(1, 100, false);
  const testnet = { ...season(2, 200, true), name: "testnet-200" };
  const rehearsal = { ...season(3, 300, true), name: "testnet-300", clock_scale: 4 };
  for (const signedIn of [false, true]) expect(chooseSeason([rehearsal, testnet, playtest], signedIn)?.game_id).toBe(1);
  expect(chooseSeason([testnet, rehearsal], true)).toBeUndefined();
  const ended = { ...testnet, status: "Ended" } as DirectoryGame;
  expect(endedSeasons([ended], [ended]).map(({ game_id }) => game_id)).not.toContain(2);
});

it("prefers a live season over a future one, even with realms in both", () => {
  const live = season(1, 100, true);
  const future = { ...season(2, 200, true), status: "Registration" } as DirectoryGame;
  for (const signedIn of [false, true]) expect(chooseSeason([future, live], signedIn)?.game_id).toBe(1);
});

describe("Frontier's day from the directory", () => {
  const now = 1_790_000_000;

  it("reads the served day: one-based, today's end, the time left and tomorrow's length", () => {
    const day = directoryDay({ day_index: 11, day_ends_at: now + 26_040, next_day_length: 86_400 }, now);
    expect(day).toMatchObject({ day: 12, endsAt: now + 26_040, secondsLeft: 26_040, tomorrowSeconds: 86_400 });
    expect(day.tone).toBe("calm");
    expect(directoryDay({ day_index: 11, day_ends_at: now + 600, next_day_length: 86_400 }, now).tone).toBe("ember");
  });

  it("leaves every field unknown when the directory serves none, never a zero", () => {
    const unknown = { day: undefined, endsAt: undefined, secondsLeft: undefined, tomorrowSeconds: undefined };
    expect(directoryDay({}, now)).toMatchObject(unknown);
    expect(directoryDay({ day_index: null, day_ends_at: null, next_day_length: null }, now)).toMatchObject(unknown);
  });

  it("drops a day whose end has passed until the directory reads again", () => {
    expect(directoryDay({ day_index: 11, day_ends_at: now - 1, next_day_length: 86_400 }, now).day).toBeUndefined();
  });

  it("never guesses the share of today it does not know", () => {
    expect(directoryDay({ day_index: 11, day_ends_at: now + 26_040, next_day_length: 86_400 }, now).shareLeft).toBe(
      undefined,
    );
  });
});

describe("the season's number", () => {
  it("names the season by the number the directory serves", () => {
    expect(seasonTitle({ chainId: "0x52", game_id: 3, name: "frontier-3", season_number: 3, clock_scale: 1 })).toBe(
      "Season 3",
    );
    expect(seasonTitle({ chainId: "0x52", game_id: 3, name: "frontier-3", season_number: null, clock_scale: 1 })).toBe(
      "Season",
    );
  });

  it("names non-season games via isRehearsal and isAccelerated: Final testnet at real speed, Rehearsal when accelerated", () => {
    const testnet = { chainId: "0x52", game_id: 3, name: "testnet-1795479180", season_number: null, clock_scale: 1 };
    const rehearsal = { chainId: "0x52", game_id: 3, name: "rehearsal-4x", season_number: null, clock_scale: 4 };
    expect(isRehearsal(testnet)).toBe(true);
    expect(isAccelerated(testnet)).toBe(false);
    expect(seasonTitle(testnet)).toBe(PLAY_WORDS.finalTestnet);
    expect(isRehearsal(rehearsal)).toBe(true);
    expect(isAccelerated(rehearsal)).toBe(true);
    expect(seasonTitle(rehearsal)).toBe("Rehearsal");
  });

  it("is the one rule that reads the directory's number: no other code of the client names a season", () => {
    const src = fileURLToPath(new URL("../", import.meta.url));
    const readers = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(`${src}${file}`, "utf8").includes("season_number"))
      .toSorted();
    // The lab's directory fixtures write the number; only seasonTitle reads it.
    expect(readers).toEqual(["shell/lab/app-lab-fixtures.ts", "shell/season.ts"]);
  });

  it("names a season by the number the directory serves: a chain's first season is Season 1", () => {
    expect(seasonTitle({ chainId: "0x52", game_id: 4, name: "frontier-4", season_number: 1, clock_scale: 1 })).toBe(
      "Season 1",
    );
  });

  it("names prod's archived October season by its archive's name, Playtest, with no number, and only that game", () => {
    const [archived] = ARCHIVED_SEASONS;
    expect(seasonTitle(archived!)).toBe("Playtest");
    expect(seasonTitle({ ...archived!, chainId: "0x52" })).toBe(`Season ${archived!.season_number}`);
  });
});
