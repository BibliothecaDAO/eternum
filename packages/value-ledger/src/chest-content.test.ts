import { expect, it } from "vitest";
import { ledgerEvent } from "../test-support/ledger-abi";
import { decodeChestContent } from "./codecs";

it.each([100n, 500n])("reads settled entry-share rewards at entry %s from the committed event", (entry) => {
  for (const shares of [4n, 2n, 1n]) {
    const amount = shares * entry * 10n ** 18n;
    const event = ledgerEvent("ChestOpened", {
      token_id: { low: 7, high: 1 },
      wallet: "0x123",
      content: { kind: 3, cosmetic: 0, lords: { low: amount, high: 0 } },
    });
    expect(decodeChestContent(event.data)).toEqual({ kind: "lords", amount });
  }
});

it.each([
  { kind: 0, cosmetic: 0x4040d01, expected: { kind: "cosmetic", attributes: "0x4040d01" } },
  { kind: 1, cosmetic: 0, expected: { kind: "sword" } },
  { kind: 2, cosmetic: 0, expected: { kind: "shield" } },
])("reads the ledger's whole non-token fallback: $expected.kind", ({ kind, cosmetic, expected }) => {
  const event = ledgerEvent("ChestOpened", {
    token_id: { low: 7, high: 0 },
    wallet: "0x123",
    content: { kind, cosmetic, lords: { low: 0, high: 0 } },
  });
  expect(decodeChestContent(event.data)).toEqual(expected);
});
