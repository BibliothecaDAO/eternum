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
  data: [shortString.encodeShortString("GAMEPLAY_REJECTED"), ...byteArrayFields("explorer is dead")],
});
const progress = (transactionHash: string, remaining: number) => ({
  from_address: GAMES,
  keys: [hash.getSelectorFromName("BatchProgress"), "0x7"],
  data: ["0x111", transactionHash, String(remaining)],
});

describe("an action's receipt", () => {
  it("names the game's refusal of this transaction, with its class and reason", () => {
    expect(gameplayRejection([rejected("0xdef"), rejected(TX)], GAMES, TX)).toEqual({
      statusClass: "GAMEPLAY_REJECTED",
      reason: "explorer is dead",
    });
  });

  it("finds no refusal for an applied transaction, another transaction's, or another contract's", () => {
    expect(gameplayRejection([], GAMES, TX)).toBeUndefined();
    expect(gameplayRejection([rejected("0xdef"), rejected(TX, "0x88")], GAMES, TX)).toBeUndefined();
  });

  it("refuses a malformed reason, another version, extra keys or two rejections rather than guessing", () => {
    const event = rejected(TX);
    expect(() => gameplayRejection([{ ...event, data: event.data.slice(0, -1) }], GAMES, TX)).toThrow("Malformed");
    expect(() => gameplayRejection([{ ...event, keys: event.keys.with(1, "0x2") }], GAMES, TX)).toThrow("Malformed");
    expect(() => gameplayRejection([{ ...event, keys: [...event.keys, "0x0"] }], GAMES, TX)).toThrow("Malformed");
    expect(() => gameplayRejection([event, event], GAMES, TX)).toThrow("Ambiguous");
  });

  it("reads what a batched command still has to do after this transaction", () => {
    expect(batchRemaining([progress("0xdef", 9), progress(TX, 4)], GAMES, TX)).toBe(4n);
    expect(batchRemaining([progress("0xdef", 9)], GAMES, TX)).toBeUndefined();
  });

  it("refuses a batch result out of u64 range, malformed or given twice", () => {
    expect(() => batchRemaining([{ ...progress(TX, 0), data: ["0x111", TX, String(2n ** 64n)] }], GAMES, TX)).toThrow(
      "Malformed",
    );
    expect(() => batchRemaining([{ ...progress(TX, 1), data: ["0x111", TX] }], GAMES, TX)).toThrow();
    expect(() => batchRemaining([progress(TX, 1), progress(TX, 1)], GAMES, TX)).toThrow("Ambiguous");
  });
});
