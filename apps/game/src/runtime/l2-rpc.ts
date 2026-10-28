import { environmentL2, isMainnetL2Rpc, MAINNET_L2_RPC_NAMES } from "@realms-world/chain";
import { constants, RpcProvider } from "starknet";

import { valueEnvironmentOf } from "@/shell/frame/environment";

import { env } from "../../env";

/** STRK, the token every Starknet network fee is paid in. */
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/**
 * The L2 an environment's address book may name, by that name: its chain id, its name for players, its fee (gas)
 * token and its explorer. Dev and production are both on Starknet mainnet, each with its own ledger and token.
 */
const L2_CHAINS = {
  SN_MAIN: {
    id: constants.StarknetChainId.SN_MAIN,
    label: "Starknet mainnet",
    gasToken: STRK,
    explorer: "https://voyager.online",
  },
} as const;

/** The build's environment's L2 and ledger, from that environment's checked-in address book. */
const ENVIRONMENT_L2 = environmentL2(valueEnvironmentOf(import.meta.env.VITE_PUBLIC_ENVIRONMENT));

/**
 * The environment's one L2, as its address book names it. The wallet connectors, the link proof, the ledger reads and
 * every other L2 read follow it; it is never inferred from what an RPC reports.
 */
export const L2_CHAIN = { name: ENVIRONMENT_L2.chain, ...L2_CHAINS[ENVIRONMENT_L2.chain] };

/**
 * The environment's one GameLedger, from the same address book; null until it is deployed there. Dev's and
 * production's share a chain and nothing else: a build only ever knows its own environment's.
 */
export const L2_LEDGER = ENVIRONMENT_L2.ledger;

/**
 * About one Starknet block (11 blocks took 19 s on mainnet, reports/chest-open-1.md): how often a screen reads the
 * ledger while a result it waits for is due, so it shows in the block it lands in.
 */
export const L2_BLOCK_MS = 2_000;

/** Where a player reads one of this build's L2 transactions. */
export const l2TransactionUrl = (hash: string): string => `${L2_CHAIN.explorer}/tx/${hash}`;

/** Whether a chain id, as a wallet or a payload gives it, is this build's L2. */
export const isL2Chain = (chainId: bigint | string): boolean => BigInt(chainId) === BigInt(L2_CHAIN.id);

/** This build's L2 through one of the accepted mainnet RPCs, from the build's L2 RPC variable; there is no fallback. */
export const L2_RPC_URL = acceptedL2Rpc(env.VITE_PUBLIC_L2_RPC_URL);

function acceptedL2Rpc(value: string | undefined): string {
  if (!isMainnetL2Rpc(value)) throw new Error(`VITE_PUBLIC_L2_RPC_URL must be ${MAINNET_L2_RPC_NAMES}`);
  return value!;
}

let provider: RpcProvider | null = null;

export const l2Provider = (): RpcProvider => (provider ??= new RpcProvider({ nodeUrl: L2_RPC_URL }));
