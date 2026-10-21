// @vitest-environment node
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";

import { seatSide } from "@/tokens";
import { openGameSeatsOf } from "./use-watched-side";

/** A realm created for `owner` at its place on the chain, as Herald's history serves it. */
const realm = (owner: string, block: number, event = 0, transaction = 0): HeraldHistoryEvent => ({
  block_number: block,
  event_index: event,
  transaction_index: transaction,
  transaction_hash: "0x1",
  game_id: "0x1",
  model: "StoryEvent",
  value: { owner, story: { RealmCreatedStory: { coord: { x: "0x1", y: "0x1", alt: false } } } },
});
const colourOf = (seats: bigint[], player: bigint) => seatSide(seats.indexOf(player)).colour;

describe("an open game's seats, in the order its players joined (review-side-colours-4 P2)", () => {
  it("seats players by their first realm's place on the chain, whatever order Herald pages them in", () => {
    // Herald serves its history newest first.
    const stories = [realm("0x0a", 30), realm("0x0c", 12, 4), realm("0x0b", 12, 2), realm("0x0d", 5)];
    expect(openGameSeatsOf(stories)).toEqual([0xdn, 0xbn, 0xcn, 0xan]);
  });

  it("keeps every seat when a newcomer joins, whatever their address, and when a player gains another realm", () => {
    const before = openGameSeatsOf([realm("0x0c", 9), realm("0x0b", 4)]);
    // A lower address joins after them, and 0x0b creates (or takes) another realm.
    const after = openGameSeatsOf([realm("0x0b", 40), realm("0x0a", 20), realm("0x0c", 9), realm("0x0b", 4)]);
    expect(after).toEqual([0xbn, 0xcn, 0xan]);
    for (const player of [0xbn, 0xcn]) expect(colourOf(after, player)).toBe(colourOf(before, player));
  });

  it("reads the same order however the pages overlap, and seats nobody's realm to no one", () => {
    const one = [realm("0x0b", 4), realm("0x0a", 2)];
    expect(openGameSeatsOf([...one, ...one, realm("0x0", 1)])).toEqual([0xan, 0xbn]);
  });
});
