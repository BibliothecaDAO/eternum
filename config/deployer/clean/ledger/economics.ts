import { nativePresetForId, nativePresetIdFor } from "../../../source/native";
import { CallData, uint256 } from "starknet";
import type { DeploymentGameType } from "../types";

const LORDS = 10n ** 18n;

export interface LedgerEconomicPreset {
  entry_fee: ReturnType<typeof uint256.bnToUint256>;
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
}

function lords(amount: bigint) {
  return uint256.bnToUint256(amount * LORDS);
}

export function buildLedgerEconomicPreset(
  gameType: DeploymentGameType,
  options: { sponsored?: boolean } = {},
): LedgerEconomicPreset {
  const balance = nativePresetForId(nativePresetIdFor(gameType)).ledger;
  return {
    entry_fee: lords(options.sponsored ? 0n : BigInt(balance.entryFee)),
    paid_fraction_bps: 2_000,
    decay_bps: 9_600,
    sword_price: lords(BigInt(balance.swordPrice)),
    shield_price: lords(BigInt(balance.shieldPrice)),
    mmr: {
      enabled: balance.mmrEnabled,
      mean: 1_500,
      spread: 450,
      max_delta: 45,
      k: 50,
      regression_bps: 150,
      min_players: 6,
    },
  };
}

export function buildRegisterLedgerPresetCalldata(presetId: number, preset: LedgerEconomicPreset): string[] {
  return CallData.compile([presetId, preset] as never);
}
