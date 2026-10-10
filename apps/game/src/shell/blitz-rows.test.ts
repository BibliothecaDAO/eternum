import { describe, expect, it, vi } from "vitest";

// The build's ledger (contracts/common/addresses for its L2): a paid entry is honoured only on it.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
}));

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { blitzRows, leadBlitzRow, rowEntryOf } from "./blitz-rows";
import type { DirectoryGame } from "./herald";

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
  entry: { kind: "free" },
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
    );
    expect(rows.map((row) => [row.key, row.startsAt, row.action])).toEqual([
      ["game:0xa:1", null, "spectate"],
      ["game:0xa:2", null, "enter"],
      ["game:0xa:3", 1_600, "registered"],
      ["slot:soon", 1_042, "registered"],
      ["slot:late", 5_000, "join"],
    ]);
  });

  it("counts a filling slot's seats in the game it is filling now", () => {
    const registrations = Array.from({ length: 26 }, (_, position) => ({
      ...mine,
      realmsId: `0x${position + 100}`,
      position,
    }));
    const [row] = blitzRows([], [slot("big", 2_000, { registrations })], ME);
    expect(row.seats).toEqual({ filled: 2, total: 24 });
  });

  it("keeps a closed slot's check until the player's game lists, then only the game shows", () => {
    const closed = slot("closed", 900, { closed: true, registrations: [mine] });
    expect(blitzRows([], [closed], ME).map((row) => [row.key, row.startsAt, row.action])).toEqual([
      ["slot:closed", 900, "registered"],
    ]);
    const assigned = { ...closed, frozenAt: "x", registrations: [{ ...mine, gameNumber: 1 }] };
    expect(blitzRows([], [assigned], ME).map((row) => row.key)).toEqual(["slot:closed"]);
    const anotherGame = blitz(2, { name: "closed-2" });
    expect(blitzRows([anotherGame], [assigned], ME).map((row) => row.key)).toContain("slot:closed");
    const ownGame = blitz(1, { name: "closed-1" });
    expect(blitzRows([anotherGame, ownGame], [assigned], ME).map((row) => row.key)).toEqual([
      "game:0xa:2",
      "game:0xa:1",
    ]);
    expect(blitzRows([], [assigned], "0x999")).toEqual([]);
  });

  it("leads a one-row card with the player's own game to enter, else the next slot", () => {
    const rows = blitzRows([blitz(1, {})], [slot("soon", 1_042)], ME);
    expect(leadBlitzRow(rows)?.key).toBe("slot:soon");
    const playing = blitzRows(
      [
        blitz(1, {}),
        blitz(2, { player_state: { registered: false, settled: false, roster_member: true, structures: [] } }),
      ],
      [slot("soon", 1_042)],
      ME,
    );
    expect(leadBlitzRow(playing)?.key).toBe("game:0xa:2");
  });
});

it("keeps ended Blitz games available to watch until their settled result lists", () => {
  const ended = blitz(7, {
    status: "Ended",
    player_state: { registered: true, settled: true, roster_member: true, structures: [] },
  });
  const rows = blitzRows([ended], [], ME);
  expect(rows).toMatchObject([{ key: "game:0xa:7", action: "spectate", startsAt: null }]);
  expect(leadBlitzRow(rows)?.key).toBe("game:0xa:7");
  expect(blitzRows([{ ...ended, status: "Settled" }], [], ME)).toEqual([]);
});

describe("a Blitz row's entry", () => {
  const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", shard: "0xa", gameId: 1 };

  it("reads a directory game's declared entry, as a slot's, and never defaults it to free", () => {
    const [game] = blitzRows([{ ...blitz(1, {}), entry: { kind: "paid", ledger: LEDGER } } as DirectoryGame], [], ME);
    expect(rowEntryOf(game)).toEqual({ kind: "paid", ledger: LEDGER });
    const [undeclared] = blitzRows([blitz(1, {})], [], ME);
    expect(rowEntryOf(undeclared)).toEqual({ kind: "broken" });
    const [filling] = blitzRows([], [slot("soon", 1_042)], ME);
    expect(rowEntryOf(filling)).toEqual({ kind: "free" });
  });
});

describe("a paid Blitz slot's row", () => {
  const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", shard: "0xa", gameId: 1 };

  it("opens its lobby instead of offering the free Join, and leaves its seats to the ledger", () => {
    const [paid, broken, free] = blitzRows(
      [],
      [
        slot("paid", 1_000, { entry: { kind: "paid", ledger: LEDGER }, registrations: [mine] }),
        slot("broken", 1_001, { entry: { kind: "paid" } as unknown as PlaytestSlot["entry"] }),
        slot("free", 1_002),
      ],
      ME,
    );
    expect([paid.action, broken.action, free.action]).toEqual(["open", "open", "join"]);
    // The launch service's registrations are not a paid slot's seats: the ledger counts them.
    expect(paid.seats).toEqual({ filled: null, total: null });
    expect(free.seats).toEqual({ filled: 0, total: 24 });
  });
});
