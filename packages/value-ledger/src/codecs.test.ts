import { CallData, type Abi } from "starknet";
import { expect, it } from "vitest";

import {
  decodeChest,
  chestDrawBlocksLeft,
  decodeChestBand,
  decodeChestContent,
  decodeCredits,
  decodeFrontierSeason,
  decodeLedgerPreset,
  decodeLedgerSlot,
  decodeMmrPreviews,
  decodeBlitzSeason,
  decodePlayerResult,
  decodeRegistration,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
  ledgerBool,
  ledgerInteger,
  ledgerU256,
  readConfirmedLedgerHead,
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
  // Registration: registered, sword, shield, sword credit, shield credit, paid (2), refundable, game id, registration time.
  expect(decodeRegistration(["1", "1", "0", "1", "0", String(500n * WEI), "0", "1", "7", "90"])).toEqual({
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
    refundable: true,
    gameId: 7,
    registeredAt: 90,
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
  // entry fee (2), protocol cut, chest share, paid fraction, decay, sword (2), shield (2), mmr (6), day unit,
  // claim window.
  const preset = [String(500n * WEI), "0", "2000", "500", "1000", "9600", String(500n * WEI), "0", String(450n * WEI)];
  const tail = ["0", "1", "1000", "200", "45", "32", "150", "60", "3600"];
  expect(decodeLedgerPreset([...preset, ...tail, "10", "7000"])).toMatchObject({
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
  expect(decodeChestContent(["2", "0", "0", "0"])).toEqual({ kind: "shield" });
  expect(() => decodeChestContent(["9", "0", "0", "0"])).toThrow("Unknown chest kind 9");
});

it("decodes the Frontier backing and preset calendar once with exact widths and strict bools", () => {
  const funded = ["1", "100", "200", "17", "0", "3", "0", "1", "9", "0xabc", "0", "0", "0", "0"];
  expect(decodeFrontierSeason(funded)).toMatchObject({
    start: 100,
    end: 200,
    pool: "17",
    paid: "3",
    closed: true,
    presetId: 9,
    seed: "0xabc",
  });
  expect(() => decodeFrontierSeason(Array(10).fill("0"))).toThrow("invalid_frontier_season");
  expect(() => decodeFrontierSeason([...funded.slice(0, 7), "2", ...funded.slice(8)])).toThrow();
  const preset = Array.from({ length: 20 }, () => "0");
  preset[4] = "2000";
  preset[16] = "60";
  preset[17] = "3600";
  expect(decodeLedgerPreset(preset)).toMatchObject({
    paidFraction: 2000,
    rated: false,
    dayUnit: 60,
    claimWindow: 3600,
  });
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
  expect(decodeWithdrawalPayment(["0", "0", "0", "0", "0", "0", "0", "0"])).toBeNull();
  expect(decodeWithdrawalPayment(["0", "7", "0", "1", "1", "0", "0", "123"])).toEqual({
    reportedAt: 123,
    prizeRank: 0,
    prizeCount: 0,
    paid: false,
    seasonId: 7,
    wallet: "0",
    amount: String((1n << 128n) + 1n),
  });
  expect(decodeWithdrawalPayment(["1", "7", "0xabc", "5", "0", "0", "0", "123"])).toEqual({
    reportedAt: 123,
    prizeRank: 0,
    prizeCount: 0,
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
    expect(() => decodeWithdrawalPayment([...fields, "0", "0", "123"])).toThrow();
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

it("decodes a rank band's token reward as shares of the entry and its odds, at the band's exact width", () => {
  // metadata, then common, uncommon, rare, epic, legendary, lords, sword, shield, then the token reward's shares.
  const band = ["0x4040d01", "4000", "2500", "1500", "700", "300", "500", "250", "250", "4"];
  expect(decodeChestBand(band)).toEqual({ lordsOdds: 500, lordsShares: 4 });
  expect(decodeChestBand(["0", "5000", "3000", "1000", "500", "0", "0", "250", "250", "0"])).toEqual({
    lordsOdds: 0,
    lordsShares: 0,
  });
  // The band that carried a fixed amount was one felt wider.
  for (const fields of [band.slice(1), [...band, "0"]]) expect(() => decodeChestBand(fields)).toThrow();
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

it("pins a confirmed header through a read-only provider", async () => {
  expect(
    await readConfirmedLedgerHead(
      {
        getBlock: async () => ({
          block_number: 12,
          block_hash: "0xab",
          timestamp: 100,
          status: "ACCEPTED_ON_L2",
        }),
      },
      12,
    ),
  ).toEqual({ number: 12, hash: "0xab", time: 100 });
});
it.each([
  null,
  {},
  { status: "PRE_CONFIRMED" },
  { block_number: "12", block_hash: "0xab", timestamp: 100, status: "ACCEPTED_ON_L2" },
  { block_number: 12, block_hash: "0xab", timestamp: "100", status: "ACCEPTED_ON_L2" },
  { block_number: 12, block_hash: "0xab", timestamp: 100, status: [] },
])("refuses a malformed or preconfirmed header %j", async (block) => {
  await expect(readConfirmedLedgerHead({ getBlock: async () => block })).rejects.toThrow("ledger_head_unconfirmed");
});

// preview_mmr's return type (mmr-1), encoded by starknet.js itself: the decoder must read what the library writes.
const MMR_PREVIEW_ABI: Abi = [
  {
    type: "struct",
    name: "game_ledger::types::MmrPreview",
    members: [
      { name: "wallet", type: "core::starknet::contract_address::ContractAddress" },
      { name: "mmr_before", type: "core::integer::u128" },
      { name: "mmr_after", type: "core::integer::u128" },
      { name: "delta", type: "core::integer::i32" },
    ],
  },
  {
    type: "function",
    name: "previews",
    inputs: [{ name: "previews", type: "core::array::Array::<game_ledger::types::MmrPreview>" }],
    outputs: [],
    state_mutability: "view",
  },
];

it("reads each wallet's rating change from preview_mmr, a loss as a negative number", () => {
  // The ledger's golden tie deltas: [26, 7, 7, -11].
  const previews = [
    { wallet: "0xa1", mmr_before: 1000, mmr_after: 1026, delta: 26 },
    { wallet: "0xb2", mmr_before: 1000, mmr_after: 1007, delta: 7 },
    { wallet: "0xc3", mmr_before: 1000, mmr_after: 1007, delta: 7 },
    { wallet: "0xd4", mmr_before: 1000, mmr_after: 989, delta: -11 },
  ];
  const fields = new CallData(MMR_PREVIEW_ABI).compile("previews", { previews }).map(String);
  expect(decodeMmrPreviews(fields)).toEqual([
    { wallet: "0xa1", mmrBefore: 1000, mmrAfter: 1026, delta: 26 },
    { wallet: "0xb2", mmrBefore: 1000, mmrAfter: 1007, delta: 7 },
    { wallet: "0xc3", mmrBefore: 1000, mmrAfter: 1007, delta: 7 },
    { wallet: "0xd4", mmrBefore: 1000, mmrAfter: 989, delta: -11 },
  ]);
  expect(decodeMmrPreviews(["0"])).toEqual([]);
  expect(() => decodeMmrPreviews(fields.slice(0, -1))).toThrow("invalid_mmr_preview");
  expect(() => decodeMmrPreviews(["1", "0xa1", "1000", "1000", String(2n ** 31n)])).toThrow("invalid_ledger_i32");
});

it("counts a chest's draw down to the block where open_finish may run: the request's block plus 11", () => {
  // The draw reads block 101's hash; Starknet serves it from block 111.
  expect(chestDrawBlocksLeft(100, 100)).toBe(11);
  expect(chestDrawBlocksLeft(100, 110)).toBe(1);
  expect(chestDrawBlocksLeft(100, 111)).toBe(0);
  expect(chestDrawBlocksLeft(100, 140)).toBe(0);
});
