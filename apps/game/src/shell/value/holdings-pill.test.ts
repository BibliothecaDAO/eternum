import { describe, expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { holdingsOf } from "./holdings-pill";

const REALM = { entity_id: 7, category: 1, realm_id: 3098, level: 1 };
const game = (game_id: number, name: string, fragments: number | null, ancient_seal: boolean, realm = false) =>
  ({
    chainId: "0xa",
    game_id,
    name,
    mode: "frontier",
    status: "Live",
    clock_scale: 1,
    clock: { start_settling_at: 0, start_main_at: game_id, scheduled_end_at: 9_000, end_at: 9_000 },
    player_state: {
      registered: realm,
      settled: realm,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: realm ? [REALM] : [],
      fragments,
      ancient_seal,
    },
  }) as unknown as DirectoryGame;

describe("the top bar's Fragments and Ancient Seal", () => {
  it("are the season's, even while the player also plays the testnet", () => {
    const season = game(1, "frontier-1", 40, false);
    const testnet = game(2, "testnet-2", 1_500, true, true);
    expect(holdingsOf([testnet, season])).toEqual({ fragments: 40, ancientSeal: false });
  });

  it("are the live testnet's when no season runs, never an ended one's, whatever the directory's order", () => {
    const ended = { ...game(1, "testnet-1", 90, false, true), status: "Ended" } as DirectoryGame;
    const live = game(2, "testnet-2", 1_500, true, true);
    expect(holdingsOf([ended, live])).toEqual({ fragments: 1_500, ancientSeal: true });
    expect(holdingsOf([live, ended])).toEqual({ fragments: 1_500, ancientSeal: true });
  });

  it("are the live testnet's while the season is still in registration, and the season's once it is live", () => {
    const upcoming = { ...game(3, "frontier-3", 0, false), status: "Registration" } as DirectoryGame;
    const live = game(2, "testnet-2", 1_500, true, true);
    expect(holdingsOf([upcoming, live])).toEqual({ fragments: 1_500, ancientSeal: true });
    expect(holdingsOf([{ ...upcoming, status: "Live" } as DirectoryGame, live])).toEqual({
      fragments: 0,
      ancientSeal: false,
    });
    expect(holdingsOf([upcoming])).toEqual({ fragments: 0, ancientSeal: false });
  });

  it("show nothing where the game sells no Fragments, or with no game to read", () => {
    expect(holdingsOf([game(1, "frontier-1", null, false)])).toBeNull();
    expect(holdingsOf([])).toBeNull();
  });
});
