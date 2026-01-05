/**
 * Re-export from shared package for backwards compatibility.
 * Desktop-specific customization: uses env.VITE_PUBLIC_CARTRIDGE_API_BASE
 */
import { useFactoryWorlds as useFactoryWorldsBase, type FactoryWorld, type Chain } from "@bibliothecadao/game-selection";
import { env } from "../../env";

export type { FactoryWorld, Chain };

/**
 * Desktop-specific wrapper that provides the cartridge API base from env
 */
export const useFactoryWorlds = (chains: Chain[], enabled = true) => {
  return useFactoryWorldsBase(chains, {
    enabled,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg",
  });
};
