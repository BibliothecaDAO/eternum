import { describe, expect, it } from "bun:test";
import { buildLedgerEconomicPreset, buildRegisterLedgerPresetCalldata } from "../ledger/economics";

describe("ledger economics", () => {
  it("reads the same day unit as the shard's exact immutable preset", async () => {
    const { nativePresetForId } = await import("../../../source/native");
    for (const presetId of [5, 101]) {
      const preset = buildLedgerEconomicPreset("frontier", { presetId });
      expect(preset.day_unit_seconds).toBe(nativePresetForId(presetId).dayUnitSeconds);
      expect(preset.season_bags).toBe(nativePresetForId(presetId).seasonBags);
      expect(buildRegisterLedgerPresetCalldata(presetId, preset)[19]).toBe(String(preset.season_bags));
      expect(buildRegisterLedgerPresetCalldata(presetId, preset)[18]).toBe(String(preset.day_unit_seconds));
    }
    expect(buildLedgerEconomicPreset("blitz").day_unit_seconds).toBe(0);
    expect(() => buildLedgerEconomicPreset("blitz", { presetId: 5 })).toThrow("game type differs");
  });
  it("builds the approved Blitz preset", () => {
    const preset = buildLedgerEconomicPreset("blitz");

    expect(preset).toMatchObject({
      protocol_cut_bps: 2_000,
      paid_fraction_bps: 2_000,
      decay_bps: 9_600,
      mmr: { enabled: true, mean: 1_500, spread: 450, max_delta: 45, k: 50, regression_bps: 150, min_players: 6 },
    });
    expect(BigInt(preset.entry_fee.low)).toBe(500_000_000_000_000_000_000n);
    expect(buildRegisterLedgerPresetCalldata(1, preset).length).toBe(87);
  });

  it("disables fees and MMR for Eternum without creating an invalid payout preset", () => {
    const preset = buildLedgerEconomicPreset("eternum");

    expect(BigInt(preset.entry_fee.low)).toBe(0n);
    expect(preset.protocol_cut_bps).toBe(0);
    expect(preset.mmr.enabled).toBe(false);
    expect(preset.paid_fraction_bps).toBeGreaterThan(0);
    expect(preset.decay_bps).toBeGreaterThan(0);
  });

  it("keeps Blitz economics but removes the entry fee for a sponsored game", () => {
    const preset = buildLedgerEconomicPreset("blitz", { sponsored: true });

    expect(BigInt(preset.entry_fee.low)).toBe(0n);
    expect(BigInt(preset.sword_price.low)).toBe(500_000_000_000_000_000_000n);
    expect(preset.paid_fraction_bps).toBe(2_000);
    expect(preset.mmr.enabled).toBe(true);
  });
  it("keeps the Frontier preset free of treasury cuts", () => {
    expect(buildLedgerEconomicPreset("frontier", { protocolCutBps: 2000 }).protocol_cut_bps).toBe(0);
  });

  it("serializes the chest LORDS share as an admin preset", () => {
    const preset = buildLedgerEconomicPreset("blitz", { chestLordsBps: 500 });
    expect(preset.chest_lords_bps).toBe(500);
    expect(buildRegisterLedgerPresetCalldata(1, preset).slice(3, 5)).toEqual(["2000", "500"]);
  });
});

describe("mystery chest economics", () => {
  it("calibrates nominal chest rewards to the 24-player net entry contribution", async () => {
    const { buildMysteryChestPreset } = await import("../../../../contracts/l2/ledger/scripts/chest-preset.js");
    const chest = buildMysteryChestPreset(1n);
    const counts = [5, 5, 4, 5, 5];
    const nominal = chest.bands.reduce((total, band, index) => {
      expect(Object.values(band.odds).reduce((sum, weight) => sum + weight, 0)).toBe(10_000);
      return total + BigInt(counts[index] * band.odds.lords) * BigInt(band.lords_amount.low);
    }, 0n);
    expect(nominal).toBe(480n * 10_000n);
    const afterCut = (24n * 500n * 8_000n) / 10_000n;
    expect((afterCut * 500n) / 10_000n).toBe(480n);
  });
});
