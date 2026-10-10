import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { blitzRows, leadBlitzRow } from "./blitz-rows";
import type { DirectoryGame } from "./herald";

const NOW = 1_000;

const blitz = (gameId: number, over: Partial<DirectoryGame>): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: gameId,
    mode: "blitz",
    ready: true,
    status: "Live",
    player_count: 24,
    roster_count: 24,
    clock: { start_settling_at: 0, start_main_at: 0, end_at: 9_000, end_grace_seconds: 0 },
    player_state: { registered: false, settled: false, roster_member: false, structures: [] },
    ...over,
  }) as DirectoryGame;

const slot = (name: string, closesAtSeconds: number, over: Partial<PlaytestSlot> = {}): PlaytestSlot => ({
  entry: { kind: "paid", ledger: { address: "0x10", chainId: "0x2", shard: "0xa", gameId: 7 } },
  name,
  closesAt: new Date(closesAtSeconds * 1000).toISOString(),
  frozenAt: null,
  closed: false,
  ...over,
});

describe("the lobby's Blitz rows", () => {
  it("lists live games, then games about to start, then filling slots, each with its one action", () => {
    const rows = blitzRows(
      [
        // A roster game still being prepared: the player's seat is theirs, the game not open yet.
        blitz(3, {
          ready: false,
          status: "Registration",
          clock: { start_settling_at: 0, start_main_at: 1_600, end_at: 9_000, end_grace_seconds: 0 },
          player_state: { registered: false, settled: false, roster_member: true, structures: [] },
        }),
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_member: true, structures: [] } }),
        blitz(4, { status: "Settled" }),
        { ...blitz(5, {}), mode: "frontier" },
      ],
      [slot("late", 5_000), slot("soon", 1_042), slot("frozen", 900, { frozenAt: "x", closed: true })],
      NOW,
    );
    expect(rows.map((row) => [row.key, row.secondsLeft, row.action])).toEqual([
      ["game:0xa:1", null, "spectate"],
      ["game:0xa:2", null, "enter"],
      ["game:0xa:3", 600, "registered"],
      ["slot:soon", 42, null],
      ["slot:late", 4_000, null],
    ]);
  });

  it("does not invent a roster or free join action from scheduling metadata", () => {
    const [row] = blitzRows([], [slot("paid", 2000)], NOW);
    expect(row.seats).toBeNull();
    expect(row.action).toBeNull();
    expect(blitzRows([], [slot("closed", 900, { closed: true })], NOW)).toEqual([]);
  });

  it("leads a one-row card with the player's own game to enter, else the next slot", () => {
    const rows = blitzRows([blitz(1, {})], [slot("soon", 1_042)], NOW);
    expect(leadBlitzRow(rows)?.key).toBe("slot:soon");
    const playing = blitzRows(
      [
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_member: true, structures: [] } }),
      ],
      [slot("soon", 1_042)],
      NOW,
    );
    expect(leadBlitzRow(playing)?.key).toBe("game:0xa:2");
  });
});

it("keeps ended Blitz games available to watch until their settled result lists", () => {
  const ended = blitz(7, {
    status: "Ended",
    player_state: { registered: true, settled: true, roster_member: true, structures: [] },
  });
  const rows = blitzRows([ended], [], NOW);
  expect(rows).toMatchObject([{ key: "game:0xa:7", action: "spectate", secondsLeft: null }]);
  expect(leadBlitzRow(rows)?.key).toBe("game:0xa:7");
  expect(blitzRows([{ ...ended, status: "Settled" }], [], NOW)).toEqual([]);
});
