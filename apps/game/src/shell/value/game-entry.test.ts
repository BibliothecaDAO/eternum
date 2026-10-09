import { expect, it } from "vitest";

import { directoryGameEntryOf, gameEntryOf } from "./game-entry";

const LEDGER = { address: "0xl", feeToken: "0xf", shard: "0x52", gameId: 7 };
const PAID = { kind: "paid", ledger: { address: "0xl", feeToken: "0xf", key: { shard: "0x52", gameId: 7 } } };

it("reads a paid entry's ledger, and a payload that names no entry as free", () => {
  expect(gameEntryOf({ entry: { kind: "paid", ledger: LEDGER } })).toEqual(PAID);
  expect(gameEntryOf({ entry: { kind: "free" } })).toEqual({ kind: "free" });
  expect(gameEntryOf({ name: "blitz-1630" })).toEqual({ kind: "free" });
});

it("shows a paid entry without a whole ledger reference as broken, never as the free join", () => {
  expect(gameEntryOf({ entry: { kind: "paid" } })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: { kind: "paid", ledger: { ...LEDGER, feeToken: undefined } } })).toEqual({
    kind: "broken",
  });
  expect(gameEntryOf({ entry: { kind: "paid", ledger: { ...LEDGER, gameId: "7" } } })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: "paid" })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: { kind: "sponsored" } })).toEqual({ kind: "broken" });
});

it("refuses a directory game whose ledger key names another game", () => {
  const game = (ledger: object) => ({ chainId: "0x52", game_id: 7, entry: { kind: "paid", ledger } });
  expect(directoryGameEntryOf(game(LEDGER))).toEqual(PAID);
  expect(directoryGameEntryOf(game({ ...LEDGER, gameId: 8 }))).toEqual({ kind: "broken" });
  expect(directoryGameEntryOf(game({ ...LEDGER, shard: "0x53" }))).toEqual({ kind: "broken" });
});
