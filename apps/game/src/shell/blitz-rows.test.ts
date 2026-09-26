import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { blitzRows, leadBlitzRow } from "./blitz-rows";
import type { DirectoryGame } from "./herald";

const NOW = 1_000;
const ME = "0x7";

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
  name,
  closesAt: new Date(closesAtSeconds * 1000).toISOString(),
  frozenAt: null,
  closed: false,
  registrations: [],
  ...over,
});

const mine = { realmsId: ME, position: 0, gameNumber: null } as PlaytestSlot["registrations"][number];

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
      [
        slot("late", 5_000),
        slot("soon", 1_042, { registrations: [mine] }),
        slot("frozen", 900, { frozenAt: "x", closed: true }),
      ],
      ME,
      NOW,
    );
    expect(rows.map((row) => [row.key, row.secondsLeft, row.action])).toEqual([
      ["game:0xa:1", null, "spectate"],
      ["game:0xa:2", null, "enter"],
      ["game:0xa:3", 600, "registered"],
      ["slot:soon", 42, "registered"],
      ["slot:late", 4_000, "join"],
    ]);
  });

  it("counts a filling slot's seats in the game it is filling now", () => {
    const registrations = Array.from({ length: 26 }, (_, position) => ({
      ...mine,
      realmsId: `0x${position + 100}`,
      position,
    }));
    const [row] = blitzRows([], [slot("big", 2_000, { registrations })], ME, NOW);
    expect(row.seats).toEqual({ filled: 2, total: 24 });
  });

  it("keeps a closed slot's check until the player's game lists, then only the game shows", () => {
    const closed = slot("closed", 900, { closed: true, registrations: [mine] });
    expect(blitzRows([], [closed], ME, NOW).map((row) => [row.key, row.secondsLeft, row.action])).toEqual([
      ["slot:closed", 0, "registered"],
    ]);
    const assigned = { ...closed, frozenAt: "x", registrations: [{ ...mine, gameNumber: 1 }] };
    expect(blitzRows([], [assigned], ME, NOW)).toEqual([]);
  });

  it("leads a one-row card with the player's own game to enter, else the next slot", () => {
    const rows = blitzRows([blitz(1, {})], [slot("soon", 1_042)], ME, NOW);
    expect(leadBlitzRow(rows)?.key).toBe("slot:soon");
    const playing = blitzRows(
      [
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_member: true, structures: [] } }),
      ],
      [slot("soon", 1_042)],
      ME,
      NOW,
    );
    expect(leadBlitzRow(playing)?.key).toBe("game:0xa:2");
  });
});
