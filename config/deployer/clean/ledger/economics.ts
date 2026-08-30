import { CallData, uint256 } from "starknet";
import type { DeploymentGameType } from "../types";

const LORDS = 10n ** 18n;

export interface LedgerEconomicPreset {
  entry_fee: ReturnType<typeof uint256.bnToUint256>;
  protocol_cut_bps: number;
  paid_fraction_bps: number;
  decay_bps: number;
  sword_price: ReturnType<typeof uint256.bnToUint256>;
  shield_price: ReturnType<typeof uint256.bnToUint256>;
  mmr: {
    enabled: boolean;
    mean: number;
    spread: number;
    max_delta: number;
    k: number;
    regression_bps: number;
    min_players: number;
  };
  pm: {
    fee_bps: number;
    liability_cap: ReturnType<typeof uint256.bnToUint256>;
    seed: ReturnType<typeof uint256.bnToUint256>;
    claim_window_seconds: number;
  };
}

function lords(amount: bigint) {
  return uint256.bnToUint256(amount * LORDS);
}

export function buildLedgerEconomicPreset(
  gameType: DeploymentGameType,
  options: { sponsored?: boolean } = {},
): LedgerEconomicPreset {
  const isBlitz = gameType === "blitz";
  return {
    entry_fee: lords(isBlitz && !options.sponsored ? 500n : 0n),
    protocol_cut_bps: isBlitz ? 2_000 : 0,
    paid_fraction_bps: 2_000,
    decay_bps: 9_600,
    sword_price: lords(isBlitz ? 500n : 0n),
    shield_price: lords(isBlitz ? 500n : 0n),
    mmr: {
      enabled: isBlitz,
      mean: 1_500,
      spread: 450,
      max_delta: 45,
      k: 50,
      regression_bps: 150,
      min_players: 6,
    },
    pm: {
      fee_bps: isBlitz ? 500 : 0,
      liability_cap: lords(isBlitz ? 10_000n : 0n),
      seed: lords(isBlitz ? 100n : 0n),
      claim_window_seconds: 604_800,
    },
  };
}

export function buildRegisterLedgerPresetCalldata(presetId: number, preset: LedgerEconomicPreset): string[] {
  return CallData.compile([presetId, preset] as never);
}

export function resolveLedgerFundingAmount(currentPool: bigint, targetPool: bigint): bigint {
  return currentPool < targetPool ? targetPool - currentPool : 0n;
}
