import type { Chain } from "@contracts";

export const GLOBAL_TORII_BY_CHAIN: Record<"mainnet" | "slot", string> = {
  mainnet: "https://api.cartridge.gg/x/eternum-global-mainnet/torii",
  slot: "https://api.cartridge.gg/x/blitz-slot-global-1/torii",
};

export const MMR_TOKEN_BY_CHAIN: Partial<Record<Chain, string>> = {
  slot: "0x00065804c556e4d5f76ccefd389c83b017addac8358ff61e58247e1995385bef",
};
