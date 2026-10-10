import { expect, it, vi } from "vitest";

const SN_MAIN = "0x534e5f4d41494e";
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  l2Provider: () => ({ callContract: async () => ["0x10e5"] }),
}));

import { directoryGameEntryOf, gameEntryOf, ledgerOf } from "./game-entry";

const LEDGER = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", feeToken: "0x57e1", shard: "0x52", gameId: 7 };
const PAID = {
  kind: "paid",
  ledger: { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", feeToken: "0x57e1", shard: "0x52", gameId: 7 },
};

it("reads a paid entry's ledger and a free entry, and a payload with no entry as broken, never free", () => {
  expect(gameEntryOf({ entry: { kind: "paid", ledger: LEDGER } })).toEqual(PAID);
  expect(gameEntryOf({ entry: { kind: "free" } })).toEqual({ kind: "free" });
  // The services make entry required: a payload without one is a fault.
  expect(gameEntryOf({})).toEqual({ kind: "broken" });
});

it("shows a paid entry without a whole ledger reference as broken, never as the free join", () => {
  expect(gameEntryOf({ entry: { kind: "paid" } })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: { kind: "paid", ledger: { ...LEDGER, feeToken: undefined } } })).toEqual({
    kind: "broken",
  });
  expect(gameEntryOf({ entry: { kind: "paid", ledger: { ...LEDGER, gameId: "7" } } })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: { kind: "paid", ledger: { ...LEDGER, chainId: undefined } } })).toEqual({
    kind: "broken",
  });
  expect(gameEntryOf({ entry: "paid" })).toEqual({ kind: "broken" });
  expect(gameEntryOf({ entry: { kind: "sponsored" } })).toEqual({ kind: "broken" });
});

it("refuses a directory game whose ledger key names another game", () => {
  const game = (ledger: object) => ({ chainId: "0x52", game_id: 7, entry: { kind: "paid", ledger } });
  expect(directoryGameEntryOf(game(LEDGER))).toEqual(PAID);
  expect(directoryGameEntryOf(game({ ...LEDGER, gameId: 8 }))).toEqual({ kind: "broken" });
  expect(directoryGameEntryOf(game({ ...LEDGER, shard: "0x53" }))).toEqual({ kind: "broken" });
});

it("reads a ledger on this build's chain, and refuses, loudly, one the entry places on another", async () => {
  const onThisChain = { address: "0x1ed9e7", chainId: SN_MAIN, feeToken: "0x57e1", shard: "0x52", gameId: 7 };
  await expect(ledgerOf(onThisChain).lordsToken()).resolves.toBe("0x10e5");
  expect(() => ledgerOf({ ...onThisChain, chainId: "0x534e5f5345504f4c4941" })).toThrow(
    "Ledger 0x1ed9e7 is on chain 0x534e5f5345504f4c4941; this build reads SN_MAIN",
  );
});
