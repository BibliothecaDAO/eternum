import { getSelector } from "@apibara/starknet";

export const ZERO_ADDRESS = "0x0";
export const BURN_ADDRESS = "0x1";

export const EVENT_SELECTORS = {
  burn: getSelector("Burn"),
  feeAmountChanged: getSelector("FeeAmountChanged"),
  feeToChanged: getSelector("FeeToChanged"),
  mint: getSelector("Mint"),
  pairCreated: getSelector("PairCreated"),
  swap: getSelector("Swap"),
  sync: getSelector("Sync"),
  transfer: getSelector("Transfer"),
} as const;

export const CANDLE_INTERVALS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};
