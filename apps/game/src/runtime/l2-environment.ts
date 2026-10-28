// The build config loads this module, and tools load the build config before any workspace package is built (the
// static checks install and run without a build). So the address-book reader comes from the chain package's source,
// which needs nothing built, never from its dist.
import { isMainnetL2Rpc, MAINNET_L2_RPC_NAMES } from "../../../../packages/chain/src/l2-rpc";
import { environmentL2 } from "../../../../packages/chain/src/value-plane";

import { valueEnvironmentOf } from "../shell/frame/environment";

/**
 * Why a build's L2 RPC is refused, or null when it is sound: VITE_PUBLIC_L2_RPC_URL is one of the accepted RPCs for the
 * L2 the build's environment names in its address book (contracts/common/addresses: Starknet mainnet for dev and for
 * production), never another public node or another network's. The identity Worker holds its RPC to the same list.
 */
export const l2EnvironmentProblem = (environment: string | undefined, rpcUrl: string | undefined): string | null => {
  const { chain } = environmentL2(valueEnvironmentOf(environment));
  if (!rpcUrl?.trim())
    return `VITE_PUBLIC_L2_RPC_URL is required: the team's L2 RPC for ${chain}, from .env.local or the deployment command`;
  return isMainnetL2Rpc(rpcUrl)
    ? null
    : `VITE_PUBLIC_L2_RPC_URL must be the https RPC for ${chain}: ${MAINNET_L2_RPC_NAMES}`;
};
