import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { lobbyId, lobbyStep, seatsOf } from "./lobby";

const ME = "0x7";

const registration = (
  index: number,
  realmsId: string | null = `0x${100 + index}`,
  gameNumber: number | null = null,
) => ({
  realmsId,
  account: `0x${(1000 + index).toString(16)}`,
  position: index,
  gameNumber,
});

const slot = (registrations: PlaytestSlot["registrations"]): PlaytestSlot => ({
  name: "blitz-1630",
  closesAt: new Date(2_000_000).toISOString(),
  frozenAt: null,
  closed: false,
  registrations,
});

const slotRow = (value: PlaytestSlot, action: BlitzRow["action"]): BlitzRow => ({
  kind: "slot",
  key: `slot:${value.name}`,
  slot: value,
  startsAt: 2_000,
  seats: { filled: value.registrations.length, total: 24 },
  action,
});

const gameRow = (action: BlitzRow["action"], startsAt: number | null, playerCount = 10): BlitzRow => ({
  kind: "game",
  key: "game:0xa:7",
  game: { name: "blitz-1630-1", player_count: playerCount, clock: { start_main_at: 1_000 } } as DirectoryGame,
  startsAt,
  seats: { filled: 24, total: 24 },
  action,
});

describe("a Blitz lobby", () => {
  it("is addressed by its row without colons", () => {
    expect(lobbyId({ key: "game:0xa:7" })).toBe("game-0xa-7");
  });

  it("offers Join without a seat, then nothing while the joined player waits: a seat cannot be given up", () => {
    const open = slot([registration(1)]);
    expect(lobbyStep(slotRow(open, "join"), [], ME)).toEqual({ kind: "join" });
    const joined = slot([registration(1), registration(2, ME)]);
    expect(lobbyStep(slotRow(joined, "registered"), [], ME)).toEqual({ kind: "joined" });
  });

  it("prepares until the roster's realms are ready, then Enter; Watch a live game the player is not on", () => {
    expect(lobbyStep(gameRow("registered", 1_000, 15), [], ME)).toEqual({ kind: "preparing", ready: 15, total: 24 });
    expect(lobbyStep(gameRow("enter", 1_000), [], ME)).toEqual({ kind: "enter" });
    expect(lobbyStep(gameRow("spectate", null), [], ME)).toEqual({ kind: "watch" });
  });

  it("calls a game full before the player joined, and names the next game with seats", () => {
    const next = slotRow(slot([]), "join");
    expect(lobbyStep(gameRow("spectate", 1_000), [next], ME)).toEqual({ kind: "full", next });
  });

  it("seats the game a slot is filling now, and a launched game's own roster, the player's own ringed", () => {
    const filling = slot(
      Array.from({ length: 26 }, (_, index) => registration(index, index === 25 ? ME : `0x${100 + index}`)),
    );
    expect(seatsOf(slotRow(filling, "registered"), [], ME)).toEqual([
      { account: registration(24).account, own: false },
      { account: registration(25).account, own: true },
    ]);
    const launched = slot([registration(1, "0x9", 1), registration(2, ME, 1), registration(3, "0xa", 2)]);
    expect(seatsOf(gameRow("enter", 1_000), [launched], ME).map((seat) => seat.own)).toEqual([false, true]);
  });
});
