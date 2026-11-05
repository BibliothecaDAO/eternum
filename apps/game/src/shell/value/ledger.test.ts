import type { ProviderInterface } from "starknet";
import { expect, it } from "vitest";

import {
  ledgerReader,
  lordsCentsTextOf,
  lordsOf,
  lordsTextOf,
  lordsWeiOf,
  refundCall,
  registerCalls,
  transferLordsCall,
} from "./ledger";

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

it("reads LORDS as a player types them, and writes them back the same way", () => {
  expect(lordsWeiOf("12")).toBe(12n * WEI);
  expect(lordsWeiOf(" 0.5 ")).toBe(WEI / 2n);
  expect(lordsWeiOf("1.000000000000000001")).toBe(WEI + 1n);
  for (const typed of ["", "1.", ".5", "-1", "1e3", "1.0000000000000000001", "abc"])
    expect(lordsWeiOf(typed)).toBeNull();
  expect(lordsTextOf(12n * WEI)).toBe("12");
  expect(lordsTextOf(WEI / 2n)).toBe("0.5");
  expect(lordsTextOf(WEI + 1n)).toBe("1.000000000000000001");
  expect(lordsWeiOf(lordsTextOf(1_234_567_891_234_567_891n))).toBe(1_234_567_891_234_567_891n);
});

it("writes a fee to two decimals rounded up, never under what it may take, and a balance rounded down", () => {
  const fee = 7_880_650_978_512_778_123n;
  expect(lordsCentsTextOf(fee, "up")).toBe("7.89");
  expect(lordsCentsTextOf(fee, "down")).toBe("7.88");
  expect(lordsCentsTextOf(9n * WEI, "up")).toBe("9.00");
  expect(lordsCentsTextOf(1n, "up")).toBe("0.01");
  expect(lordsCentsTextOf(1n, "down")).toBe("0.00");
  expect(lordsCentsTextOf(1_234n * WEI + WEI / 20n, "down")).toBe("1234.05");
});

it("sends LORDS with the token's transfer, its amount as a u256", () => {
  expect(transferLordsCall("0x124", "0x5", (1n << 128n) + 7n)).toEqual({
    contractAddress: "0x124",
    entrypoint: "transfer",
    calldata: ["0x5", "7", "1"],
  });
});
