import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { blitzRows, gameKeyOf, gameSlotKeyOf, leadBlitzRow, seatedGameOf, slotKeyOf } from "./blitz-rows";
import type { DirectoryGame } from "./herald";

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
    player_state: { registered: false, settled: false, roster_wallet: null, structures: [] },
    ...over,
  }) as DirectoryGame;

const slot = (name: string, closesAtSeconds: number, over: Partial<PlaytestSlot> = {}): PlaytestSlot => ({
  slotId: 3,
  chainId: "0xa",
  name,
  closesAt: new Date(closesAtSeconds * 1000).toISOString(),
  frozenAt: null,
  closed: false,
  ...over,
});

describe("the lobby's Blitz rows", () => {
  it("lists live games, then games about to start, then filling slots, each with its one action: a slot opens its lobby", () => {
    const rows = blitzRows(
      [
        // A roster game still being prepared: the player's seat is theirs, the game not open yet.
        blitz(3, {
          ready: false,
          status: "Registration",
          clock: { start_settling_at: 0, start_main_at: 1_600, end_at: 9_000, end_grace_seconds: 0 },
          player_state: { registered: false, settled: false, roster_wallet: "0x4a1", structures: [] },
        }),
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_wallet: "0x4a1", structures: [] } }),
        blitz(4, { status: "Settled" }),
        { ...blitz(5, {}), mode: "frontier" },
      ],
      [slot("late", 5_000), slot("soon", 1_042), slot("frozen", 900, { frozenAt: "x", closed: true })],
    );
    expect(rows.map((row) => [row.key, row.startsAt, row.action])).toEqual([
      ["game:0xa:1", null, "spectate"],
      ["game:0xa:2", null, "enter"],
      ["game:0xa:3", 1_600, "registered"],
      ["slot:soon", 1_042, "open"],
      ["slot:late", 5_000, "open"],
    ]);
  });

  it("leads a one-row card with the player's own game to enter, else the next slot", () => {
    const rows = blitzRows([blitz(1, {})], [slot("soon", 1_042)]);
    expect(leadBlitzRow(rows)?.key).toBe("slot:soon");
    const playing = blitzRows(
      [
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_wallet: "0x4a1", structures: [] } }),
      ],
      [slot("soon", 1_042)],
    );
    expect(leadBlitzRow(playing)?.key).toBe("game:0xa:2");
  });
});

it("keeps ended Blitz games available to watch until their settled result lists", () => {
  const ended = blitz(7, {
    status: "Ended",
    player_state: { registered: true, settled: true, roster_wallet: "0x4a1", structures: [] },
  });
  const rows = blitzRows([ended], []);
  expect(rows).toMatchObject([{ key: "game:0xa:7", action: "spectate", startsAt: null }]);
  expect(leadBlitzRow(rows)?.key).toBe("game:0xa:7");
  expect(blitzRows([{ ...ended, status: "Settled" }], [])).toEqual([]);
});

describe("a Blitz's keys on the ledger", () => {
  it("keys a slot by its shard and number, and a launched game by its own id and the slot it filled", () => {
    expect(slotKeyOf(slot("soon", 1_042))).toEqual({ shard: "0xa", slotId: 3 });
    const game = blitz(7, { slotId: 3 });
    expect(gameKeyOf(game)).toEqual({ shard: "0xa", gameId: 7 });
    expect(gameSlotKeyOf(game)).toEqual({ shard: "0xa", slotId: 3 });
  });

  it("names no slot key for a game outside any slot", () => {
    expect(gameSlotKeyOf(blitz(7, { slotId: null }))).toBeNull();
    expect(gameSlotKeyOf(blitz(7, {}))).toBeNull();
  });
});

describe("the game that seats a wallet", () => {
  const seat = (wallet: string | null) => ({ registered: true, settled: false, roster_wallet: wallet, structures: [] });
  const games = [
    blitz(7, { slotId: 3, player_state: seat("0x04a1") }),
    blitz(8, { slotId: 3, player_state: seat(null) }),
    blitz(9, { slotId: 4, player_state: seat("0x4a1") }),
  ];

  it("is the slot's launched game whose roster froze that wallet for the reader's seat", () => {
    expect(seatedGameOf(games, { shard: "0xa", slotId: 3 }, "0x4a1")?.game_id).toBe(7);
    expect(seatedGameOf(games, { shard: "0x0a", slotId: 4 }, "0x4a1")?.game_id).toBe(9);
  });

  it("is none for another wallet, another slot, another shard, or a game outside any slot", () => {
    expect(seatedGameOf(games, { shard: "0xa", slotId: 3 }, "0xb0b")).toBeUndefined();
    expect(seatedGameOf(games, { shard: "0xa", slotId: 5 }, "0x4a1")).toBeUndefined();
    expect(seatedGameOf(games, { shard: "0xb", slotId: 3 }, "0x4a1")).toBeUndefined();
    expect(
      seatedGameOf([blitz(7, { player_state: seat("0x4a1") })], { shard: "0xa", slotId: 3 }, "0x4a1"),
    ).toBeUndefined();
  });
});

describe("a closed slot that owes the player a refund", () => {
  const closed = slot("closed", 900, { frozenAt: "x", closed: true });

  it("keeps its row, last, with the refund as its one action, until the refund is taken", () => {
    const rows = blitzRows([], [closed, slot("open", 1_042)], new Set(["closed"]));
    expect(rows.map((row) => [row.key, row.action])).toEqual([
      ["slot:open", "open"],
      ["slot:closed", "refund"],
    ]);
    expect(blitzRows([], [closed, slot("open", 1_042)]).map((row) => row.key)).toEqual(["slot:open"]);
  });

  it("never leads the Blitz card ahead of a slot to open", () => {
    const rows = blitzRows([], [closed, slot("open", 1_042)], new Set(["closed"]));
    expect(leadBlitzRow(rows)?.key).toBe("slot:open");
    expect(leadBlitzRow(blitzRows([], [closed], new Set(["closed"])))?.action).toBe("refund");
  });
});

describe("a Blitz slot's row", () => {
  it("opens its lobby, where its entry is paid, and draws no seats: the ledger counts its registrations", () => {
    const [row] = blitzRows([], [slot("paid", 1_000)]);
    expect(row.action).toBe("open");
    expect(row).not.toHaveProperty("seats");
  });
});
