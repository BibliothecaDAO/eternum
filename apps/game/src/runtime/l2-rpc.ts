import { environmentL2, resolveEndpoint } from "@realms-world/chain";
import { constants } from "starknet";

import { valueEnvironmentOf } from "@/shell/frame/environment";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";

import { env } from "../../env";

/** STRK, the token every Starknet network fee is paid in, at its address on both networks. */
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** Each L2 an environment can run on: its chain id, its name for players, its fee (gas) token and its explorer. */
const L2_CHAINS = {
  SN_MAIN: {
    id: constants.StarknetChainId.SN_MAIN,
    label: "Starknet mainnet",
    gasToken: STRK,
    explorer: "https://voyager.online",
  },
  SN_SEPOLIA: {
    id: constants.StarknetChainId.SN_SEPOLIA,
    label: "Starknet Sepolia",
    gasToken: STRK,
    explorer: "https://sepolia.voyager.online",
  },
} as const;

/** The build's environment's L2 and ledger, from that environment's checked-in address book. */
const ENVIRONMENT_L2 = environmentL2(valueEnvironmentOf(import.meta.env.VITE_PUBLIC_ENVIRONMENT));

/**
 * The environment's one L2: Sepolia for dev, mainnet for production. The wallet connectors, the link proof, the
 * ledger reads and every other L2 read follow it; it is never inferred from what an RPC reports.
 */
export const L2_CHAIN = { name: ENVIRONMENT_L2.chain, ...L2_CHAINS[ENVIRONMENT_L2.chain] };

/** The environment's one GameLedger, from the same address book; null until it is deployed there. */
export const L2_LEDGER = ENVIRONMENT_L2.ledger;

/** Where a player reads one of this build's L2 transactions. */
export const l2TransactionUrl = (hash: string): string => `${L2_CHAIN.explorer}/tx/${hash}`;

/** Whether a chain id, as a wallet or a payload gives it, is this build's L2. */
export const isL2Chain = (chainId: bigint | string): boolean => BigInt(chainId) === BigInt(L2_CHAIN.id);

/** This build's L2 through our Alchemy RPC, from the build's L2 RPC variable; there is no public fallback. */
export const L2_RPC_URL = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
  name: "VITE_PUBLIC_IDENTITY_RPC_URL",
  browserFacing: true,
});

export const l2Provider = () => getCachedRpcProvider(L2_RPC_URL);
