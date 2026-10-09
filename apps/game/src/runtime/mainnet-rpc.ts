import { resolveEndpoint } from "@realms-world/chain";

import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";

import { env } from "../../env";

/** Starknet mainnet through our RPC: where linked wallets, LORDS, STRK and the ledger live. */
export const MAINNET_RPC_URL = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});

export const mainnetProvider = () => getCachedRpcProvider(MAINNET_RPC_URL);
