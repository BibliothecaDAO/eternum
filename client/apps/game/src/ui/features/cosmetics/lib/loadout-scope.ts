import type { Chain } from "@contracts";

export const resolveCosmeticsLoadoutNetworkForChain = (chain: Chain): "mainnet" | "sepolia" =>
  chain === "mainnet" ? "mainnet" : "sepolia";

export const resolveCosmeticsLoadoutScopeKeyForChain = (chain: Chain): string =>
  `cosmetics:${resolveCosmeticsLoadoutNetworkForChain(chain)}`;
