import { describe, expect, it } from "vitest";

import type { DirectoryGame } from "./herald";
import { chooseSeason } from "./season";

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
