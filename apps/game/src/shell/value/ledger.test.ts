import type { ProviderInterface } from "starknet";
import { expect, it } from "vitest";

import { ledgerReader, lordsOf, refundCall, registerCalls } from "./ledger";

const WEI = 10n ** 18n;
const KEY = { shard: "0x5245414c4d53", slotId: 7 };

it("approves what the entry costs on the ledger's LORDS token, then registers in the slot with the flags as 0 or 1", () => {
  const big = 2n ** 130n + 5n;
  expect(registerCalls("0xledger", "0x10e5", KEY, true, false, big)).toEqual([
    { contractAddress: "0x10e5", entrypoint: "approve", calldata: ["0xledger", "5", "4"] },
    { contractAddress: "0xledger", entrypoint: "register", calldata: ["0x5245414c4d53", "7", "1", "0"] },
  ]);
  // A seat a credit covers whole costs nothing in LORDS: no approval is asked for.
  expect(registerCalls("0xledger", "0x10e5", KEY, false, true, 0n).map((call) => call.entrypoint)).toEqual([
    "register",
  ]);
  expect(refundCall("0xledger", KEY)).toEqual({
    contractAddress: "0xledger",
    entrypoint: "refund",
    calldata: ["0x5245414c4d53", "7"],
  });
});

it("counts held LORDS in whole units, rounded down", () => {
  expect(lordsOf(1_234n * WEI + 999n)).toBe(1234);
});

it("reads the LORDS token and the chest collection from the ledger itself, and balances on the token it names", async () => {
  const calls: { contractAddress: string; entrypoint: string; calldata?: unknown }[] = [];
  const provider = {
    callContract: async (call: { contractAddress: string; entrypoint: string; calldata?: unknown }) => {
      calls.push(call);
      if (call.entrypoint === "lords") return ["0x10e5"];
      if (call.entrypoint === "chest_collection") return ["0xc4e57"];
      return ["7", "1"];
    },
  } as unknown as ProviderInterface;
  const read = ledgerReader(provider, "0xledger");
  await expect(read.lordsToken()).resolves.toBe("0x10e5");
  await expect(read.chestCollection()).resolves.toBe("0xc4e57");
  await expect(read.balanceOf("0x57e1", "0x4a1")).resolves.toBe(7n + (1n << 128n));
  expect(calls.map(({ contractAddress, entrypoint }) => [contractAddress, entrypoint])).toEqual([
    ["0xledger", "lords"],
    ["0xledger", "chest_collection"],
    ["0x57e1", "balance_of"],
  ]);
});
