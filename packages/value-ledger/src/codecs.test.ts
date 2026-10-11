import { expect, it } from "vitest";

import {
  decodeChest,
  decodeChestContent,
  decodeCredits,
  decodeFrontierSeason,
  decodeLedgerPreset,
  decodeLedgerSlot,
  decodeBlitzSeason,
  decodePlayerResult,
  decodeRegistration,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
  ledgerBool,
  ledgerInteger,
  ledgerU256,
} from "./codecs";

const WEI = 10n ** 18n;

it("reads a slot and a registration in the interface's field order", () => {
  // Slot: season, exists, preset, close, end, pool (2), registered count, cancelled.
  expect(decodeLedgerSlot(["3", "1", "9", "100", "200", String(9n * WEI), "0", "31", "0"])).toEqual({
    exists: true,
    seasonId: 3,
    presetId: 9,
    close: 100,
    end: 200,
    pool: String(9n * WEI),
    registeredCount: 31,
    cancelled: false,
  });
  expect(decodeLedgerSlot(["0", "0", "0", "0", "0", "0", "0", "0", "0"]).exists).toBe(false);
  expect(() => decodeLedgerSlot(["3", "1", "9"])).toThrow("invalid_ledger_slot");
  // Registration: registered, sword, shield, sword credit, shield credit, paid (2), refundable, game id.
  expect(decodeRegistration(["1", "1", "0", "1", "0", String(500n * WEI), "0", "1", "7"])).toEqual({
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
    refundable: true,
    gameId: 7,
  });
  expect(() => decodeRegistration(["1", "1", "0"])).toThrow("invalid_ledger_registration");
  expect(decodeCredits(["2", "0"])).toEqual({ swords: 2, shields: 0 });
  expect(() => decodeCredits(["2"])).toThrow("shorter than its type");
});

it("reads a season and a preset in the interface's order, prices and pools exact", () => {
  // chest reserve (2), participants, top count, posted, challenged, review until, settlement started, paid (2),
  // exists, preset, start, end, pool (2).
  const season = ["0", "0", "500", "50", "1", "0", "7200", "0", "0", "0", "1", "4", "100", "3600"];
  expect(decodeBlitzSeason([...season, String(9n * WEI), "0"])).toEqual({
    participantCount: 500,
    topCount: 50,
    posted: true,
    challenged: false,
    reviewUntil: 7200,
    settlementStarted: false,
    presetId: 4,
    start: 100,
    end: 3600,
    pool: String(9n * WEI),
  });
  // entry fee (2), protocol cut, chest share, paid fraction, decay, sword (2), shield (2), mmr (7), day unit, bags,
  // claim window.
  const preset = [String(500n * WEI), "0", "2000", "500", "1000", "9600", String(500n * WEI), "0", String(450n * WEI)];
  const tail = ["0", "1", "1000", "200", "45", "32", "150", "6", "60", "10", "3600"];
  expect(decodeLedgerPreset([...preset, ...tail])).toMatchObject({
    entryFee: String(500n * WEI),
    protocolCut: 2000,
    chestLords: 500,
    paidFraction: 1000,
    decay: 9600,
    swordPrice: String(500n * WEI),
    shieldPrice: String(450n * WEI),
  });
});

it("reads a result and what an opened chest delivered, in the interface's order", () => {
  // PlayerResult: rank, chest_id (2), mmr_before, mmr_after.
  expect(decodePlayerResult(["3", "41", "0", "1744", "1780"])).toEqual({
    rank: 3,
    chestId: 41n,
    mmrBefore: 1744,
    mmrAfter: 1780,
  });
  // ChestContent (the ChestOpened event's data): kind, cosmetic, lords (2).
  expect(decodeChestContent(["0", "0x4040d01", "0", "0"])).toEqual({ kind: "cosmetic", attributes: "0x4040d01" });
  expect(decodeChestContent(["3", "0", String(700n * WEI), "0"])).toEqual({ kind: "lords", amount: 700n * WEI });
  expect(decodeChestContent(["2", "0", "0", "0"])).toEqual({ kind: "shield" });
  expect(() => decodeChestContent(["9", "0", "0", "0"])).toThrow("Unknown chest kind 9");
});

it("decodes the Frontier backing and preset calendar once with exact widths and strict bools", () => {
  const funded = ["1", "100", "200", "17", "0", "3", "0", "1", "9", "0xabc"];
  expect(decodeFrontierSeason(funded)).toMatchObject({
    configured: true,
    start: 100,
    end: 200,
    pool: "17",
    paid: "3",
    closed: true,
    presetId: 9,
    seed: "0xabc",
  });
  expect(() => decodeFrontierSeason([...funded.slice(0, 7), "2", ...funded.slice(8)])).toThrow();
  const preset = Array.from({ length: 20 }, () => "0");
  preset[4] = "2000";
  preset[17] = "60";
  preset[18] = "10";
  preset[19] = "3600";
  expect(decodeLedgerPreset(preset)).toMatchObject({ paidFraction: 2000, dayUnit: 60, bags: 10, claimWindow: 3600 });
  expect(() => decodeLedgerPreset(preset.slice(1))).toThrow();
});

it.each(["", " ", "-1", "0x", "garbage"])(
  "refuses malformed numeric fields instead of silently reading zero: %s",
  (value) => {
    expect(() => ledgerBool(value)).toThrow();
    expect(() => ledgerInteger(value)).toThrow();
    expect(() => ledgerU256(value, "0")).toThrow();
  },
);
it("bounds each u256 limb and safe integer before conversion", () => {
  expect(ledgerU256("1", "1")).toBe(String((1n << 128n) + 1n));
  expect(() => ledgerU256(String(1n << 128n), "0")).toThrow();
  expect(() => ledgerInteger(String(1n << 60n))).toThrow();
});

it("decodes absent, reported and paid withdrawals without losing the high amount limb", () => {
  expect(decodeWithdrawalPayment(["0", "0", "0", "0", "0"])).toBeNull();
  expect(decodeWithdrawalPayment(["0", "7", "0", "1", "1"])).toEqual({
    paid: false,
    seasonId: 7,
    wallet: "0",
    amount: String((1n << 128n) + 1n),
  });
  expect(decodeWithdrawalPayment(["1", "7", "0xabc", "5", "0"])).toEqual({
    paid: true,
    seasonId: 7,
    wallet: "0xabc",
    amount: "5",
  });
  for (const fields of [
    ["0", "7", "0", "0"],
    ["2", "7", "0", "5", "0"],
    ["1", "7", "0", "5", "0"],
    ["0", "7", "0xabc", "5", "0"],
    ["0", "7", "0", "0", "0"],
    ["0", "7", "0", "0", String(1n << 128n)],
  ])
    expect(() => decodeWithdrawalPayment(fields)).toThrow();
});

it("decodes the complete chest shape and rejects absent or malformed records", () => {
  const chest = ["1", "7", "2", "1", "0", "0xabc", "100"];
  expect(decodeChest(chest)).toEqual({
    seasonId: 7,
    band: 2,
    requested: true,
    finished: false,
    requester: "0xabc",
    requestBlock: 100,
  });
  for (const fields of [
    chest.slice(1),
    ["0", ...chest.slice(1)],
    [...chest.slice(0, 3), "2", ...chest.slice(4)],
    [...chest.slice(0, 6), String(1n << 60n)],
  ])
    expect(() => decodeChest(fields)).toThrow();
});

it("decodes one winner and its full allocated share and rejects incomplete or absent winners", () => {
  expect(decodeSeasonWinner(["0xabc", "7", "1"])).toEqual({ wallet: "0xabc", share: (1n << 128n) + 7n });
  for (const fields of [
    ["0xabc", "7"],
    ["0", "7", "0"],
    ["0xabc", "0", String(1n << 128n)],
  ])
    expect(() => decodeSeasonWinner(fields)).toThrow();
});
