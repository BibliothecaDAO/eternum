import type { GameChain as Chain } from "@realms-world/chain";

export const resolveCosmeticsLoadoutScopeKeyForChain = (chain: Chain): string => `cosmetics:${chain}`;
