import type { Chain } from "@contracts";
import { env } from "../../env";

const CARTRIDGE_API_BASE = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

/** Public RPC per chain: mainnet/sepolia via the Cartridge gateway (read-only
 * identity/value lookups), everything else the deployment's own node. */
export const getRpcUrlForChain = (chain: Chain | string): string => {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API_BASE}/x/starknet/mainnet`;
    case "sepolia":
      return `${CARTRIDGE_API_BASE}/x/starknet/sepolia`;
    default:
      return env.VITE_PUBLIC_NODE_URL;
  }
};
