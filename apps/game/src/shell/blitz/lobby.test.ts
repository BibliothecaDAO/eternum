import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { lobbyId, lobbyStep, seatsOf } from "./lobby";

const slotRow = (): BlitzRow => ({
  kind: "slot",
  key: "slot:blitz-1630",
  slot: { name: "blitz-1630", closesAt: new Date(2_000_000).toISOString() } as PlaytestSlot,
  startsAt: 2_000,
  seats: { filled: null, total: null },
  action: "open",
});

const PLAYER = "0x00b7";

const gameRow = (
  action: BlitzRow["action"],
  startsAt: number | null,
  roster?: DirectoryGame["roster"],
  filled = 24,
): BlitzRow => ({
  kind: "game",
  key: "game:0xa:7",
  game: { name: "blitz-1630-1", player_count: filled, clock: { start_main_at: 1_000 }, roster } as DirectoryGame,
  startsAt,
  seats: { filled, total: 24 },
  action,
});

describe("a Blitz lobby", () => {
  it("is addressed by its row without colons", () => {
    expect(lobbyId({ key: "game:0xa:7" })).toBe("game-0xa-7");
  });

  it("prepares until the roster's realms are ready, then Enter; Watch a live game the player is not on", () => {
    expect(lobbyStep(gameRow("registered", 1_000), [])).toEqual({ kind: "preparing" });
    expect(lobbyStep(gameRow("enter", 1_000), [])).toEqual({ kind: "enter" });
    expect(lobbyStep(gameRow("spectate", null), [])).toEqual({ kind: "watch" });
  });

  it("calls a game full before the player joined, and names the next slot", () => {
    const next = slotRow();
    expect(lobbyStep(gameRow("spectate", 1_000), [next])).toEqual({ kind: "full", next });
  });

  it("seats a slot from the ledger's registered count, unnamed, none before the ledger answers, and opens it", () => {
    const unnamed = { account: null, own: false, prepared: undefined };
    expect(seatsOf(slotRow(), PLAYER, 3)).toEqual([unnamed, unnamed, unnamed]);
    expect(seatsOf(slotRow(), PLAYER, undefined)).toEqual([]);
    expect(lobbyStep(slotRow(), [])).toEqual({ kind: "open" });
  });

  it("seats a launched game from Herald's roster, each ticked once its player's realm is ready", () => {
    const roster = [
      { account: "0xa1", prepared: true },
      { account: "0xb7", prepared: false },
    ];
    expect(seatsOf(gameRow("registered", 1_000, roster, 2), PLAYER, 2)).toEqual([
      { account: "0xa1", own: false, prepared: true },
      { account: "0xb7", own: true, prepared: false },
    ]);
  });

  it("leaves a launched game's taken seats unnamed and their preparation unknown when Herald serves no roster", () => {
    const seats = seatsOf(gameRow("registered", 1_000, undefined, 3), PLAYER, 3);
    expect(seats).toEqual(Array.from({ length: 3 }, () => ({ account: null, own: false, prepared: undefined })));
  });
});
