import { expect, it } from "vitest";
import { readGameEntry } from "./game-entry";
it("requires explicit terms and a complete paid ledger reference including its L2 chain", () => {
  expect(readGameEntry({ kind: "free" })).toEqual({ kind: "free" });
  const paid = { kind: "paid", ledger: { address: "0x1", chainId: "0x2", feeToken: "0x3", shard: "0x4", gameId: 7 } };
  expect(readGameEntry(paid)).toEqual(paid);
  for (const value of [
    undefined,
    {},
    { kind: "paid", ledger: { ...paid.ledger, chainId: undefined } },
    { kind: "paid", ledger: { ...paid.ledger, feeToken: "0x0" } },
  ])
    expect(() => readGameEntry(value)).toThrow();
});
