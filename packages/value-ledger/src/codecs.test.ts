import { expect, it } from "vitest";

import {
  decodeChest,
  decodeChestContent,
  decodeCredits,
  decodeFrontierSeason,
  decodeGame,
  decodeLedgerPreset,
  decodeBlitzSeason,
  decodePlayerResult,
  decodeRegistration,
} from "./codecs";

const WEI = 10n ** 18n;
const WALLET = "0x4a1";

it("reads the ledger's answers in the interface's field order", () => {
  // Game: season, exists, preset, start, end, pool (2), commitment, registered, cancelled, finalized, limit.
  expect(decodeGame(["3", "1", "9", "100", "200", "0", "0", "0xabc", "17", "1", "0", "2"])).toEqual({
    seasonId: 3,
    presetId: 9,
    start: 100,
    end: 200,
    exists: true,
    commitment: "0xabc",
    registeredCount: 17,
    cancelled: true,
    finalized: false,
    registrationLimit: 2,
  });
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
  // claim window, registration limit.
  const preset = [String(500n * WEI), "0", "2000", "500", "1000", "9600", String(500n * WEI), "0", String(450n * WEI)];
  const tail = ["0", "1", "1000", "200", "45", "32", "150", "6", "60", "10", "3600", "24"];
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

it("reads a result, a band chest and what an opened one delivered, in the interface's order", () => {
  // PlayerResult: rank, chest_id (2), mmr_before, mmr_after.
  expect(decodePlayerResult(["3", "41", "0", "1744", "1780"])).toEqual({
    rank: 3,
    chestId: 41n,
    mmrBefore: 1744,
    mmrAfter: 1780,
  });
  // Chest: exists, season_id, band, requested, finished, requester, request_block.
  expect(decodeChest(["1", "3", "0", "1", "0", WALLET, "812300"])).toEqual({
    seasonId: 3,
    band: 0,
    requested: true,
    finished: false,
    requester: WALLET,
    requestBlock: 812300,
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
  const preset = Array.from({ length: 21 }, () => "0");
  preset[4] = "2000";
  preset[17] = "60";
  preset[18] = "10";
  preset[19] = "3600";
  expect(decodeLedgerPreset(preset)).toMatchObject({ paidFraction: 2000, dayUnit: 60, bags: 10, claimWindow: 3600 });
  expect(() => decodeLedgerPreset(preset.slice(1))).toThrow();
});
