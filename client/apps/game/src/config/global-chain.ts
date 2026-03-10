import type { Chain } from "@contracts";

export const GLOBAL_TORII_BY_CHAIN: Record<"mainnet" | "slot", string> = {
  mainnet: "https://api.cartridge.gg/x/blitz-mainnet-global-1/torii",
  slot: "https://api.cartridge.gg/x/blitz-slot-global-1/torii",
};

export const MMR_TOKEN_BY_CHAIN: Partial<Record<Chain, string>> = {
  mainnet: "0x00d5a3c8c5ebcacf3279aafd2de3eb0c4736afc11be6f41c84880080fa7a1aaf",
  slot: "0x00065804c556e4d5f76ccefd389c83b017addac8358ff61e58247e1995385bef",
};
