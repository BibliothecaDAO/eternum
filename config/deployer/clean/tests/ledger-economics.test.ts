import { describe, expect, it } from "bun:test";
import {
  buildLedgerEconomicPreset,
  buildRegisterLedgerPresetCalldata,
  resolveLedgerFundingAmount,
} from "../ledger/economics";

describe("ledger economics", () => {
  it("builds the approved Blitz preset", () => {
    const preset = buildLedgerEconomicPreset("blitz");

    expect(preset).toMatchObject({
      protocol_cut_bps: 2_000,
      paid_fraction_bps: 2_000,
      decay_bps: 9_600,
      mmr: { enabled: true, mean: 1_500, spread: 450, max_delta: 45, k: 50, regression_bps: 150, min_players: 6 },
      pm: { fee_bps: 500, claim_window_seconds: 604_800 },
    });
    expect(BigInt(preset.entry_fee.low)).toBe(500_000_000_000_000_000_000n);
    expect(BigInt(preset.pm.liability_cap.low)).toBe(10_000_000_000_000_000_000_000n);
    expect(buildRegisterLedgerPresetCalldata(1, preset).length).toBeGreaterThan(20);
  });

  it("disables fees and MMR for Eternum without creating an invalid payout preset", () => {
    const preset = buildLedgerEconomicPreset("eternum");

    expect(BigInt(preset.entry_fee.low)).toBe(0n);
    expect(preset.mmr.enabled).toBe(false);
    expect(preset.paid_fraction_bps).toBeGreaterThan(0);
    expect(preset.decay_bps).toBeGreaterThan(0);
  });

  it("keeps Blitz economics but removes the entry fee for a sponsored game", () => {
    const preset = buildLedgerEconomicPreset("blitz", { sponsored: true });

    expect(BigInt(preset.entry_fee.low)).toBe(0n);
    expect(BigInt(preset.sword_price.low)).toBe(500_000_000_000_000_000_000n);
    expect(preset.protocol_cut_bps).toBe(2_000);
    expect(preset.mmr.enabled).toBe(true);
  });

  it("tops a sponsored pool up idempotently", () => {
    expect(resolveLedgerFundingAmount(12n, 20n)).toBe(8n);
    expect(resolveLedgerFundingAmount(20n, 20n)).toBe(0n);
    expect(resolveLedgerFundingAmount(24n, 20n)).toBe(0n);
  });
});
