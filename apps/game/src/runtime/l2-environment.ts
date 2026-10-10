const NETWORKS = { SN_MAIN: "mainnet", SN_SEPOLIA: "sepolia" } as const;

/**
 * Why a build's L2 environment is refused, or null when it is sound: VITE_PUBLIC_L2_CHAIN names SN_MAIN or SN_SEPOLIA,
 * and VITE_PUBLIC_IDENTITY_RPC_URL is the team's https Alchemy endpoint for that same network, never a public node or
 * the other network's. The identity Worker holds its RPC to the same rule.
 */
export const l2EnvironmentProblem = (chain: string | undefined, rpcUrl: string | undefined): string | null => {
  if (chain !== "SN_MAIN" && chain !== "SN_SEPOLIA")
    return "VITE_PUBLIC_L2_CHAIN is required: SN_SEPOLIA for dev, SN_MAIN for production, from .env.local or the CLIENT_L2_CHAIN variable";
  if (!rpcUrl?.trim())
    return "VITE_PUBLIC_IDENTITY_RPC_URL is required: the team's Alchemy URL for the build's L2, from .env.local or the CLIENT_IDENTITY_RPC_URL secret";
  return isAlchemyFor(rpcUrl, NETWORKS[chain])
    ? null
    : `VITE_PUBLIC_IDENTITY_RPC_URL must be the https Alchemy endpoint for ${chain} (starknet-${NETWORKS[chain]}.g.alchemy.com)`;
};

const isAlchemyFor = (rpcUrl: string, network: string): boolean => {
  let url: URL;
  try {
    url = new URL(rpcUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === `starknet-${network}.g.alchemy.com` &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.hash &&
    url.pathname !== "/"
  );
};
