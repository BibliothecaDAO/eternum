import type { GameChain } from "@realms-world/chain";

export const getChainLabel = (chain: GameChain): string => (chain === "madara" ? "Madara Lab" : "Appchain");
