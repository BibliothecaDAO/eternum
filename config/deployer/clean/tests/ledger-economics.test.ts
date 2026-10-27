import { describe, expect, it } from "bun:test";
import { CallData } from "starknet";
import ledgerAbi from "../../../../contracts/l2/ledger/schema/abi.json";
import { buildMysteryChestPreset } from "../../../../contracts/l2/ledger/scripts/chest-preset.js";
import { buildLedgerEconomicPreset, buildRegisterLedgerPresetCalldata } from "../ledger/economics";

describe("ledger economics", () => {
  it("registers effective day units for normal, Devcon and accelerated Frontier clocks", () => {
    for (const [presetId, dayUnit] of [
      [5, 14_400],
      [6, 4_800],
      [101, 120],
    ]) {
      const preset = buildLedgerEconomicPreset("frontier", { presetId });
      expect(preset.day_unit_seconds).toBe(dayUnit);
      expect(buildRegisterLedgerPresetCalldata(presetId, preset)[17]).toBe(String(dayUnit));
    }
    expect(buildLedgerEconomicPreset("blitz").day_unit_seconds).toBe(0);
    expect(() => buildLedgerEconomicPreset("blitz", { presetId: 5 })).toThrow("game type differs");
  });
  it("reads the same claim-window preset as the shard without a second override", async () => {
    const { nativePresetForId } = await import("../../../source/native");
    for (const presetId of [5, 101]) {
      const preset = buildLedgerEconomicPreset("frontier", { presetId });
      expect(preset.claim_window_seconds).toBe(nativePresetForId(presetId).chests!.claimWindowSeconds);
      expect(buildRegisterLedgerPresetCalldata(presetId, preset)[18]).toBe(String(preset.claim_window_seconds));
    }
    expect(buildLedgerEconomicPreset("blitz").claim_window_seconds).toBe(0);
  });

  it("builds the approved Blitz preset", () => {
    const preset = buildLedgerEconomicPreset("blitz");

    expect(preset).toMatchObject({
      protocol_cut_bps: 1_000,
      paid_fraction_bps: 2_000,
      decay_bps: 9_600,
    });
    expect(preset.mmr).toEqual({ enabled: true, mean: 1_500, spread: 450, max_delta: 45, k: 50, regression_bps: 150 });
    expect(BigInt(preset.entry_fee.low)).toBe(100_000_000_000_000_000_000n);
    expect(buildRegisterLedgerPresetCalldata(1, preset).length).toBe(83);
    expect(buildRegisterLedgerPresetCalldata(1, preset)[21]).toBe("5");
  });

  it("serializes each mode's economic preset exactly as the ledger ABI", () => {
    const codec = new CallData(ledgerAbi);
    const chest = buildMysteryChestPreset();
    for (const [gameType, presetId] of [
      ["blitz", 2],
      ["eternum", 3],
      ["frontier", 5],
      ["frontier", 6],
    ] as const) {
      const preset = buildLedgerEconomicPreset(gameType, { presetId });
      expect(buildRegisterLedgerPresetCalldata(presetId, preset, chest)).toEqual(
        codec.compile("register_preset", { preset_id: presetId, preset, bands: chest.bands, items: chest.items }),
      );
    }
  });

  it("disables fees and MMR for Eternum without creating an invalid payout preset", () => {
    const preset = buildLedgerEconomicPreset("eternum");

    expect(BigInt(preset.entry_fee.low)).toBe(0n);
    expect(preset.protocol_cut_bps).toBe(0);
    expect(preset.mmr.enabled).toBe(false);
    expect(preset.paid_fraction_bps).toBeGreaterThan(0);
    expect(preset.decay_bps).toBeGreaterThan(0);
  });

  it("keeps the Frontier preset free of treasury cuts", () => {
    expect(buildLedgerEconomicPreset("frontier").protocol_cut_bps).toBe(0);
  });

  it("serializes the chest LORDS share as an admin preset", () => {
    const preset = buildLedgerEconomicPreset("blitz");
    expect(preset.chest_lords_bps).toBe(1000);
    expect(buildRegisterLedgerPresetCalldata(1, preset).slice(3, 5)).toEqual(["1000", "1000"]);
  });
});

describe("mystery chest economics", () => {
  it("prices rewards as entry shares and keeps every band's odds at 100 percent", () => {
    const chest = buildMysteryChestPreset();
    expect(chest.bands.map((band) => band.lords_shares)).toEqual([4, 2, 1, 0, 0]);
    expect(chest.bands.map((band) => band.odds.lords)).toEqual([500, 1000, 1000, 0, 0]);
    for (const band of chest.bands) {
      expect(Object.values(band.odds).reduce((sum, weight) => sum + weight, 0)).toBe(10000);
      expect(band).not.toHaveProperty("lords_amount");
    }
    expect(chest.bands.reduce((sum, band) => sum + band.lords_shares * band.odds.lords, 0) / 5 / 10000).toBe(0.1);
    for (const [environment, entry] of [
      ["dev", 100],
      ["production", 100],
    ] as const) {
      const preset = buildLedgerEconomicPreset("blitz", { environment });
      for (const price of [preset.entry_fee, preset.sword_price, preset.shield_price]) {
        expect(BigInt(price.low)).toBe(BigInt(entry) * 10n ** 18n);
        expect(BigInt(price.high)).toBe(0n);
      }
      expect(preset.protocol_cut_bps).toBe(1000);
      expect(preset.chest_lords_bps).toBe(1000);
      expect(chest.bands.slice(0, 3).map((band) => band.lords_shares * entry)).toEqual([4 * entry, 2 * entry, entry]);
    }
  });
  it("preserves non-token proportions to within one basis point", () => {
    const previous = [
      [2000, 2000, 2000, 1500, 1000, 250, 250],
      [2500, 2200, 1800, 1000, 500, 500, 500],
      [3000, 2000, 1200, 600, 200, 1250, 1250],
      [3000, 1800, 800, 300, 100, 1800, 1800],
      [2500, 1500, 700, 200, 100, 2500, 2500],
    ];
    buildMysteryChestPreset().bands.forEach((band, index) => {
      const weights = previous[index]!;
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const actual = Object.entries(band.odds)
        .filter(([name]) => name !== "lords")
        .map(([, weight]) => weight);
      weights.forEach((weight, position) =>
        expect(Math.abs(actual[position]! - (weight * (10000 - band.odds.lords)) / total)).toBeLessThan(1),
      );
    });
  });
});

it("keeps the existing duel price outside the first-deployment environment change", () => {
  const preset = buildLedgerEconomicPreset("duel");
  expect(BigInt(preset.entry_fee.low)).toBe(500n * 10n ** 18n);
  expect(preset.protocol_cut_bps).toBe(2000);
});

it("funds Frontier chests at 70 percent and reserves the remainder for the top ten", () => {
  const preset = buildLedgerEconomicPreset("frontier");
  expect(preset.frontier_chest_bps).toBe(7000);
  expect(preset.frontier_top_n).toBe(10);
});
