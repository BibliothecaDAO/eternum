import { resolveEndpoint } from "@realms-world/chain";
import { constants } from "starknet";

import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";

import { env } from "../../env";

/** STRK, the token every Starknet network fee is paid in, at its address on both networks. */
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** Each L2 a build can name: its chain id, its name for players, and its network fee (gas) token. */
const L2_CHAINS = {
  SN_MAIN: { id: constants.StarknetChainId.SN_MAIN, label: "Starknet mainnet", gasToken: STRK },
  SN_SEPOLIA: { id: constants.StarknetChainId.SN_SEPOLIA, label: "Starknet Sepolia", gasToken: STRK },
} as const;

/**
 * The environment's one L2, named by the build (VITE_PUBLIC_L2_CHAIN): Sepolia for dev, mainnet for production. The
 * wallet connectors, the link proof, the ledger reads and every other L2 read follow it; it is never inferred from
 * what an RPC reports.
 */
export const L2_CHAIN = { name: env.VITE_PUBLIC_L2_CHAIN, ...L2_CHAINS[env.VITE_PUBLIC_L2_CHAIN] };

/** Whether a chain id, as a wallet or a payload gives it, is this build's L2. */
export const isL2Chain = (chainId: bigint | string): boolean => BigInt(chainId) === BigInt(L2_CHAIN.id);

/** This build's L2 through our Alchemy RPC, from the build's L2 RPC variable; there is no public fallback. */
export const L2_RPC_URL = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});

export const l2Provider = () => getCachedRpcProvider(L2_RPC_URL);
