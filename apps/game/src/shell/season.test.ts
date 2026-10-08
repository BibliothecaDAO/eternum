import { describe, expect, it } from "vitest";

import type { DirectoryGame } from "./herald";
import { chooseSeason, directoryDay, seasonTitle } from "./season";

const season = (gameId: number, startMainAt: number, ownRealm: boolean): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: gameId,
    mode: "frontier",
    status: "Live",
    clock: { start_settling_at: 0, start_main_at: startMainAt, end_at: 9_000_000_000, end_grace_seconds: 0 },
    player_state: {
      registered: ownRealm,
      settled: ownRealm,
      roster_member: false,
      structures: ownRealm
        ? [{ entity_id: 1, category: 1, realm_id: 7, coord_x: 0, coord_y: 0, resources_packed: "0" }]
        : [],
    },
  }) as DirectoryGame;

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
    expect(seasonTitle({ season_number: 3 })).toBe("Season 3");
  });

  it("is a dash when the directory serves none, never a zero", () => {
    expect(seasonTitle({})).toBe("Season —");
    expect(seasonTitle({ season_number: null })).toBe("Season —");
  });
});
