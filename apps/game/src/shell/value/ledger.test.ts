import { expect, it } from "vitest";

import {
  decodeCredits,
  decodeGame,
  decodePrices,
  decodeRegistration,
  LORDS_TOKEN,
  lordsOf,
  refundCall,
  registerCalls,
} from "./ledger";

const WEI = 10n ** 18n;
const KEY = { shard: "0x5245414c4d53", gameId: 7 };

it("approves what the entry costs in LORDS, then registers with the flags as 0 or 1", () => {
  const big = 2n ** 130n + 5n;
  expect(registerCalls("0xledger", KEY, true, false, big)).toEqual([
    { contractAddress: LORDS_TOKEN, entrypoint: "approve", calldata: ["0xledger", "5", "4"] },
    { contractAddress: "0xledger", entrypoint: "register", calldata: ["0x5245414c4d53", "7", "1", "0"] },
  ]);
  // A seat a credit covers whole costs nothing in LORDS: no approval is asked for.
  expect(registerCalls("0xledger", KEY, false, true, 0n).map((call) => call.entrypoint)).toEqual(["register"]);
  expect(refundCall("0xledger", KEY)).toEqual({
    contractAddress: "0xledger",
    entrypoint: "refund",
    calldata: ["0x5245414c4d53", "7"],
  });
});

it("reads the ledger's answers in the interface's field order", () => {
  // Game: season, exists, preset, start, end, pool (2), entries (2), commitment, registered, cancelled, finalized.
  expect(decodeGame(["3", "1", "9", "100", "200", "0", "0", "0", "0", "0xabc", "17", "1", "0"])).toEqual({
    seasonId: 3,
    presetId: 9,
    start: 100,
    end: 200,
    registeredCount: 17,
    cancelled: true,
    finalized: false,
  });
  // Preset: entry fee (2), chest bps, chest metadata, paid fraction, decay, sword (2), shield (2), mmr (7).
  const prices = decodePrices([
    String(500n * WEI),
    "0",
    "2000",
    "0",
    "1000",
    "9600",
    String(500n * WEI),
    "0",
    String(450n * WEI),
    "0",
    "1",
    "1000",
    "200",
    "45",
    "32",
    "150",
    "6",
  ]);
  expect(prices).toEqual({ seat: 500n * WEI, sword: 500n * WEI, shield: 450n * WEI });
  // Registration: registered, sword, shield, consumed, sword credit, shield credit, paid (2), realm (2), pass kind.
  expect(decodeRegistration(["1", "1", "0", "0", "1", "0", String(500n * WEI), "0", "0", "0", "0"])).toEqual({
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
  });
  expect(decodeCredits(["2", "0"])).toEqual({ swords: 2, shields: 0 });
  expect(() => decodeCredits(["2"])).toThrow("shorter than its type");
  expect(lordsOf(1_234n * WEI + 999n)).toBe(1234);
});
