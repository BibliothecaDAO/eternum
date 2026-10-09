import { byteArray, hash, shortString } from "starknet";
import { describe, expect, it } from "vitest";

import { batchRemaining, gameplayRejection } from "./native-receipt";

const GAMES = "0x77";
const TX = "0xabc";
const byteArrayFields = (text: string) => {
  const encoded = byteArray.byteArrayFromString(text);
  return [
    String(encoded.data.length),
    ...encoded.data.map(String),
    String(encoded.pending_word),
    String(encoded.pending_word_len),
  ];
};
const rejected = (transactionHash: string, from = GAMES) => ({
  from_address: from,
  keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x7", "0x111", transactionHash],
  data: [shortString.encodeShortString("GAMEPLAY"), ...byteArrayFields("Not enough stamina to explore")],
});
const progress = (transactionHash: string, remaining: number) => ({
  from_address: GAMES,
  keys: [hash.getSelectorFromName("BatchProgress"), "0x7"],
  data: ["0x111", transactionHash, String(remaining)],
});

describe("an action's receipt", () => {
  it("names the game's refusal of this transaction, with its class and reason", () => {
    expect(gameplayRejection([rejected("0xdef"), rejected(TX)], GAMES, TX)).toEqual({
      statusClass: "GAMEPLAY",
      reason: "Not enough stamina to explore",
    });
  });

  it("finds no refusal for an applied transaction, another transaction's, or another contract's", () => {
    expect(gameplayRejection([], GAMES, TX)).toBeUndefined();
    expect(gameplayRejection([rejected("0xdef"), rejected(TX, "0x88")], GAMES, TX)).toBeUndefined();
  });

  it("refuses a malformed reason rather than showing part of one", () => {
    const event = rejected(TX);
    expect(() => gameplayRejection([{ ...event, data: event.data.slice(0, -1) }], GAMES, TX)).toThrow("Malformed");
  });

  it("reads what a batched command still has to do after this transaction", () => {
    expect(batchRemaining([progress("0xdef", 9), progress(TX, 4)], GAMES, TX)).toBe(4n);
    expect(batchRemaining([progress("0xdef", 9)], GAMES, TX)).toBeUndefined();
  });
});
