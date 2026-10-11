// The build config loads this module, and tools load the build config before any workspace package is built (the
// static checks install and run without a build). So the address-book reader comes from the chain package's source,
// which needs nothing built, never from its dist.
import { environmentL2 } from "../../../../packages/chain/src/value-plane";

import { valueEnvironmentOf } from "../shell/frame/environment";

const NETWORKS = { SN_MAIN: "mainnet", SN_SEPOLIA: "sepolia" } as const;

/**
 * Why a build's L2 RPC is refused, or null when it is sound: VITE_PUBLIC_IDENTITY_RPC_URL is the team's https Alchemy
 * endpoint for the network of the build's environment (VITE_PUBLIC_ENVIRONMENT: production on mainnet, every other
 * build on Sepolia, from contracts/common/addresses), never a public node or the other network's. The identity Worker
 * holds its RPC to the same rule.
 */
export const l2EnvironmentProblem = (environment: string | undefined, rpcUrl: string | undefined): string | null => {
  const { chain } = environmentL2(valueEnvironmentOf(environment));
  if (!rpcUrl?.trim())
    return `VITE_PUBLIC_IDENTITY_RPC_URL is required: the team's Alchemy URL for ${chain}, from .env.local or the CLIENT_IDENTITY_RPC_URL secret`;
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
