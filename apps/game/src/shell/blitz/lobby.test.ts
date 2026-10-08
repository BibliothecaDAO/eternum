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

  it("offers Join without a seat, then nothing while the joined player waits: a seat cannot be given up", () => {
    const open = slot([registration(1)]);
    expect(lobbyStep(slotRow(open, "join"), [], ME)).toEqual({ kind: "join" });
    const joined = slot([registration(1), registration(2, ME)]);
    expect(lobbyStep(slotRow(joined, "registered"), [], ME)).toEqual({ kind: "joined" });
  });

  it("prepares until the roster's realms are ready, then Enter; Watch a live game the player is not on", () => {
    expect(lobbyStep(gameRow("registered", 1_000), [], ME)).toEqual({ kind: "preparing" });
    expect(lobbyStep(gameRow("enter", 1_000), [], ME)).toEqual({ kind: "enter" });
    expect(lobbyStep(gameRow("spectate", null), [], ME)).toEqual({ kind: "watch" });
  });

  it("calls a game full before the player joined, and names the next game with seats", () => {
    const next = slotRow(slot([]), "join");
    expect(lobbyStep(gameRow("spectate", 1_000), [next], ME)).toEqual({ kind: "full", next });
  });

  it("seats the game a slot is filling now with each player's Realms id, the player's own ringed, no preparation yet", () => {
    const filling = slot(
      Array.from({ length: 26 }, (_, index) => registration(index, index === 25 ? ME : `0x${100 + index}`)),
    );
    expect(seatsOf(slotRow(filling, "registered"), ME, PLAYER)).toEqual([
      { account: registration(24).account, realmsId: "0x124", own: false, prepared: undefined },
      { account: registration(25).account, realmsId: ME, own: true, prepared: undefined },
    ]);
  });

  it("seats a launched game from Herald's roster, each ticked once its player's realm is ready", () => {
    const roster = [
      { account: "0xa1", prepared: true },
      { account: "0xb7", prepared: false },
    ];
    expect(seatsOf(gameRow("registered", 1_000, roster, 2), ME, PLAYER)).toEqual([
      { account: "0xa1", realmsId: null, own: false, prepared: true },
      { account: "0xb7", realmsId: null, own: true, prepared: false },
    ]);
  });

  it("leaves a launched game's taken seats unnamed and their preparation unknown when Herald serves no roster", () => {
    const seats = seatsOf(gameRow("registered", 1_000, undefined, 3), ME, PLAYER);
    expect(seats).toEqual(
      Array.from({ length: 3 }, () => ({ account: null, realmsId: null, own: false, prepared: undefined })),
    );
  });
});
