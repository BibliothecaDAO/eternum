import { describe, expect, it } from "vitest";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { lobbyId, lobbyRowOf, lobbyStep, seatsOf } from "./lobby";

const slotRow = (): BlitzRow => ({
  kind: "slot",
  key: "slot:blitz-1630",
  slot: { name: "blitz-1630", closesAt: new Date(2_000_000).toISOString() } as PlaytestSlot,
  startsAt: 2_000,
  action: "open",
});

const PLAYER = "0x00b7";

const game = (roster?: DirectoryGame["roster"], filled = 24) =>
  ({ name: "blitz-1630-1", player_count: filled, clock: { start_main_at: 1_000 }, roster }) as DirectoryGame;

const gameRow = (
  action: BlitzRow["action"],
  startsAt: number | null,
  roster?: DirectoryGame["roster"],
  filled = 24,
): BlitzRow => ({
  kind: "game",
  key: "game:0xa:7",
  game: game(roster, filled),
  startsAt,
  seats: { filled, total: 24 },
  action,
});

describe("a Blitz lobby", () => {
  it("is addressed by its row without colons", () => {
    expect(lobbyId({ key: "game:0xa:7" })).toBe("game-0xa-7");
  });

  it("keeps a slot's lobby past its close, when the list no longer shows it, so its outcome stays in reach", () => {
    const closed = { slotId: 3, chainId: "0xa", name: "blitz-1630", closesAt: new Date(0).toISOString() };
    const slot = { ...closed, frozenAt: "x", closed: true } as PlaytestSlot;
    expect(lobbyRowOf([], [slot], "slot-blitz-1630")).toMatchObject({ kind: "slot", slot });
    expect(lobbyRowOf([], [slot], "slot-blitz-1700")).toBeUndefined();
  });

  it("prepares until the roster's realms are ready, then Enter; Watch a game the player is not on", () => {
    expect(lobbyStep(gameRow("registered", 1_000))).toEqual({ kind: "preparing" });
    expect(lobbyStep(gameRow("enter", 1_000))).toEqual({ kind: "enter" });
    expect(lobbyStep(gameRow("spectate", null))).toEqual({ kind: "watch" });
  });

  it("never calls a game full: its roster was fixed at close, so a player not on it watches", () => {
    expect(lobbyStep(gameRow("spectate", 1_000))).toEqual({ kind: "watch" });
  });

  it("opens a slot, which draws no seats", () => {
    expect(lobbyStep(slotRow())).toEqual({ kind: "open" });
  });

  it("seats a launched game from Herald's roster, each with its frozen wallet, ticked once its player's realm is ready", () => {
    const roster = [
      { account: "0xa1", prepared: true },
      { account: "0xb7", prepared: false },
    ];
    expect(seatsOf(game(roster, 2), PLAYER)).toEqual([
      { account: "0xa1", wallet: "0xe1", own: false, prepared: true },
      { account: "0xb7", wallet: "0xe7", own: true, prepared: false },
    ]);
  });

  it("leaves a launched game's taken seats unnamed and their preparation unknown when Herald serves no roster", () => {
    const seats = seatsOf(game(undefined, 3), PLAYER);
    expect(seats).toEqual(
      Array.from({ length: 3 }, () => ({ account: null, wallet: null, own: false, prepared: undefined })),
    );
  });
});
