import { buildMysteryChestPreset } from "../../../../contracts/l2/ledger/scripts/chest-preset.js";
import { nativePresetForId, nativePresetIdFor } from "../../../source/native";
import { CallData, uint256 } from "starknet";
import environments from "../../../../deploy/first/environments.json";
import type { DeploymentGameType } from "../types";

const LORDS = 10n ** 18n;

export interface LedgerEconomicPreset {
  day_unit_seconds: number;
  claim_window_seconds: number;
  entry_fee: ReturnType<typeof uint256.bnToUint256>;
  protocol_cut_bps: number;
  chest_lords_bps: number;
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
  };
}

function lords(amount: bigint) {
  return uint256.bnToUint256(amount * LORDS);
}

export function buildLedgerEconomicPreset(
  gameType: DeploymentGameType,
  options: {
    presetId?: number;
    environment?: keyof typeof environments;
    /** The chest preset registered beside it; its reserve share becomes `chest_lords_bps`. */
    chests?: ReturnType<typeof buildMysteryChestPreset>;
  } = {},
): LedgerEconomicPreset {
  const native = nativePresetForId(options.presetId ?? nativePresetIdFor(gameType));
  if (native.gameType !== gameType) throw new Error("Ledger preset game type differs from shard preset");
  const balance = native.ledger;
  const price =
    gameType === "blitz" ? environments[options.environment ?? "production"].blitzPrice : gameType === "duel" ? 500 : 0;
  return {
    entry_fee: lords(BigInt(price)),
    protocol_cut_bps: gameType === "frontier" ? 0 : balance.protocolCutBps,
    chest_lords_bps: (options.chests ?? buildMysteryChestPreset()).chestLordsBps,
    paid_fraction_bps: 2_000,
    decay_bps: 9_600,
    sword_price: lords(BigInt(price)),
    shield_price: lords(BigInt(price)),
    mmr: {
      enabled: balance.mmrEnabled,
      mean: 1_500,
      spread: 450,
      max_delta: 45,
      k: 50,
      regression_bps: 150,
    },
    day_unit_seconds: native.dayUnitSeconds,
    claim_window_seconds: native.chests?.claimWindowSeconds ?? 0,
  };
}

export function buildRegisterLedgerPresetCalldata(
  presetId: number,
  preset: LedgerEconomicPreset,
  chestPreset = buildMysteryChestPreset(),
): string[] {
  return CallData.compile([presetId, preset, chestPreset.bands, chestPreset.items] as never);
}
