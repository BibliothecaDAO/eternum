import { resolveEndpoint } from "@realms-world/chain";
import { RpcProvider } from "starknet";

import { serverEnv } from "./env";

const provider = new RpcProvider({
  nodeUrl: resolveEndpoint(serverEnv.GAME_RPC_URL, { name: "GAME_RPC_URL", browserFacing: false }),
});

/**
 * The gameplay-account binding as a status: PlayerRegistry.account_of(owner)
 * on the game chain, read server-side so the browser never talks to the L3.
 */
export const gameplayAccountOf = async (owner: string): Promise<string | null> => {
  const [account] = await provider.callContract({
    contractAddress: serverEnv.PLAYER_REGISTRY_ADDRESS,
    entrypoint: "account_of",
    calldata: [owner],
  });
  if (account === undefined || BigInt(account) === 0n) return null;
  return account;
};
