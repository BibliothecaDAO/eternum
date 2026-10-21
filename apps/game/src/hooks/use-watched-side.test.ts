// @vitest-environment node
import { describe, expect, it } from "vitest";

import { openGameSeatsOf } from "./use-watched-side";

const sites = { total: 0, camps: 0, rifts: 0, ruins: 0, beasts: 0 };
const frontier = (address: string, structure_id: string, rank: number) => ({
  address,
  structure_id,
  rank,
  sites_cleared: sites,
  chests_earned: 0,
  rewards: { lords: "0", essence: "0", labor: "0" },
  deepest_depth: 0,
  order: 1,
});

describe("an open game's seats from its Herald board (side-colours-4)", () => {
  it("seats a Frontier season by each player's realm, in the order realms were settled, whatever their rank", () => {
    const board = {
      mode: "frontier" as const,
      entries: [frontier("0x0c", "41", 1), frontier("0x0a", "7", 2), frontier("0x0b", "12", 3)],
    };
    expect(openGameSeatsOf(board)).toEqual([0xan, 0xbn, 0xcn]);
    // A newcomer settles a later realm: the next seat, and no seat moves.
    const joined = { ...board, entries: [frontier("0x0d", "52", 1), ...board.entries] };
    expect(openGameSeatsOf(joined)).toEqual([0xan, 0xbn, 0xcn, 0xdn]);
  });

  it("seats a points game by address, its board giving no other order", () => {
    const entry = (address: string, rank: number) => ({
      address,
      rank,
      totalPoints: 0,
      activityBreakdown: {} as never,
    });
    expect(openGameSeatsOf({ mode: "points", entries: [entry("0x0c", 1), entry("0x0a", 2)] })).toEqual([0xan, 0xcn]);
  });
});
