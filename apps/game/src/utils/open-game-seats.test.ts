// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setActiveGame } from "@/runtime/world";
import { HUD_SHEET, SEAT_COLOURS } from "@/tokens";
import { onSidesChanged, seatOrder, setOpenGameSeats, watchedSide } from "./entity-ownership";
import { overrideSpectateIntent } from "./spectator-session";

/** Two shards that both number their Frontier season game 1 (review-side-colours-4 P2). */
const A = { chainId: "SHARD_A", gameId: 1 };
const B = { chainId: "SHARD_B", gameId: 1 };

/** Enters a game as the client does (its profile as the active game), watching it, on its own native store. */
const enter = (game: typeof A) => {
  setActiveGame({ ...game, name: game.chainId });
  configManager.setActiveGame(game.gameId);
  overrideSpectateIntent(true);
  return new NativeFactStore();
};

afterEach(() => {
  setOpenGameSeats({ chainId: "", gameId: 0 }, []);
  overrideSpectateIntent(false);
});

describe("an open game's seats are its own (review-side-colours-4 P2)", () => {
  it("leaves shard B's game 1 unseated while its own order is on its way or failed, never shard A's", () => {
    enter(A);
    setOpenGameSeats(A, [0xan, 0xbn]);
    expect(watchedSide(0xan)).toMatchObject({ seat: 0, colour: SEAT_COLOURS[0] });

    // Shard B's game 1, its order not read yet (or its read failed: nothing is published either way).
    enter(B);
    expect(seatOrder()).toEqual([]);
    expect(watchedSide(0xan)).toEqual({ seat: null, colour: HUD_SHEET.neutral });

    // Its own order arrives: its seats, not A's.
    setOpenGameSeats(B, [0xbn, 0xan]);
    expect(watchedSide(0xan)).toMatchObject({ seat: 1, colour: SEAT_COLOURS[1] });
  });

  it("refuses an order that arrives late for a game the viewer has left", () => {
    enter(A);
    enter(B);
    // Shard A's read, started before the viewer moved to B, answers now.
    setOpenGameSeats(A, [0xan, 0xbn]);
    expect(watchedSide(0xan)).toEqual({ seat: null, colour: HUD_SHEET.neutral });
    // Back on A, its order is the one published for it.
    enter(A);
    expect(watchedSide(0xbn)).toMatchObject({ seat: 1 });
  });

  it("tells labels again only when the order changes, and nothing by seat while the viewer plays", () => {
    enter(A);
    const heard = vi.fn();
    const stop = onSidesChanged(heard);
    setOpenGameSeats(A, [0xan]);
    setOpenGameSeats(A, [0xan]);
    expect(heard).toHaveBeenCalledTimes(1);
    setOpenGameSeats(A, [0xan, 0xbn]);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    expect(watchedSide(0n)).toEqual({ seat: null, colour: HUD_SHEET.neutral });
    overrideSpectateIntent(false);
    expect(watchedSide(0xan)).toBeNull();
  });
});
