import { describe, expect, it, vi } from "vitest";

// The build's ledger (contracts/common/addresses for its L2): a paid entry is honoured only on it.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
}));

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { blitzRows, leadBlitzRow, rowEntryOf } from "./blitz-rows";
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
  entry: { kind: "free" },
  name,
  closesAt: new Date(closesAtSeconds * 1000).toISOString(),
  frozenAt: null,
  closed: false,
  registrations: [],
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
          player_state: { registered: false, settled: false, roster_wallet: "0x123", structures: [] },
        }),
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_wallet: "0x123", structures: [] } }),
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
        blitz(2, { player_state: { registered: false, settled: false, roster_wallet: "0x123", structures: [] } }),
      ],
      [slot("soon", 1_042)],
    );
    expect(leadBlitzRow(playing)?.key).toBe("game:0xa:2");
  });
});

it("keeps ended Blitz games available to watch until their settled result lists", () => {
  const ended = blitz(7, {
    status: "Ended",
    player_state: { registered: true, settled: true, roster_wallet: "0x123", structures: [] },
  });
  const rows = blitzRows([ended], []);
  expect(rows).toMatchObject([{ key: "game:0xa:7", action: "spectate", startsAt: null }]);
  expect(leadBlitzRow(rows)?.key).toBe("game:0xa:7");
  expect(blitzRows([{ ...ended, status: "Settled" }], [])).toEqual([]);
});

describe("a Blitz row's entry", () => {
  const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", shard: "0xa", gameId: 1 };

  it("reads a directory game's declared entry, as a slot's, and never defaults it to free", () => {
    const [game] = blitzRows([{ ...blitz(1, {}), entry: { kind: "paid", ledger: LEDGER } } as DirectoryGame], []);
    expect(rowEntryOf(game)).toEqual({ kind: "paid", ledger: LEDGER });
    const [undeclared] = blitzRows([blitz(1, {})], []);
    expect(rowEntryOf(undeclared)).toEqual({ kind: "broken" });
  });
});

describe("a Blitz slot's row", () => {
  it("opens its lobby, where its entry is paid, and leaves its seats to the ledger", () => {
    const [row] = blitzRows([], [slot("paid", 1_000)]);
    expect(row.action).toBe("open");
    expect(row.seats).toEqual({ filled: null, total: null });
  });
});
