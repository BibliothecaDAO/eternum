import { resolveEndpoint } from "@realms-world/chain";

import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";

import { env } from "../../env";

/**
 * This build's one L2, through our Alchemy RPC: mainnet for production, Sepolia for a dev build. Linked wallets, LORDS,
 * the fee token and the ledger live there; there is no public fallback and no second chain.
 */
export const L2_RPC_URL = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});

export const l2Provider = () => getCachedRpcProvider(L2_RPC_URL);

let chainId: Promise<string> | undefined;

/** The chain this build's L2 RPC serves, read once; a failed read is asked again next time. */
export const l2ChainId = (): Promise<string> =>
  (chainId ??= l2Provider()
    .getChainId()
    .catch((error: unknown) => {
      chainId = undefined;
      throw error;
    }));
