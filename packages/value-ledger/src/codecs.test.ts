import { it, expect } from "vitest";
import { decodeFrontierSeason, decodeLedgerPreset, ledgerBool, ledgerInteger, ledgerU256 } from "./codecs";

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
