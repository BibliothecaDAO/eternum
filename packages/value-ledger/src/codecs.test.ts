import { it, expect } from "vitest";
import {
  decodeChest,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
  decodeFrontierSeason,
  decodeLedgerPreset,
  ledgerBool,
  ledgerInteger,
  ledgerU256,
} from "./codecs";

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
