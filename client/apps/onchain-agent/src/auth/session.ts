import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";
import { buildPolicies, type Chain, type TokenAddresses } from "./policies.js";

export interface SessionConfig {
  /** Chain name — determines manifest, season addresses, and signing domain. */
  chain: Chain;
  /** Starknet RPC URL. */
  rpcUrl: string;
  /** Starknet chain ID (e.g. "SN_MAIN" or "SN_SEPOLIA"). */
  chainId: string;
  /** Optional token addresses for entry/fee token policies. */
  tokens?: TokenAddresses;
  /** Directory for session persistence. Default: ".cartridge" */
  basePath?: string;
}

let provider: SessionProvider | null = null;

/**
 * Clear the cached provider. Useful for testing or switching chains.
 */
export function resetProvider(): void {
  provider = null;
}

/**
 * Get or create the SessionProvider singleton.
 *
 * On first call, builds policies from the Dojo manifest for the given chain,
 * creates a SessionProvider, and returns it. Subsequent calls return the
 * same instance.
 */
export function getProvider(config: SessionConfig): SessionProvider {
  if (provider) return provider;

  const policies = buildPolicies(config.chain, config.tokens);

  provider = new SessionProvider({
    rpc: config.rpcUrl,
    chainId: config.chainId,
    policies,
    basePath: config.basePath ?? ".cartridge",
  });

  return provider;
}

/**
 * Connect and return an authenticated WalletAccount.
 *
 * First run: prints a URL to open in a browser for one-time session approval.
 * Subsequent runs: reconnects from saved session on disk.
 *
 * Throws if connection fails or session is expired and re-auth is not completed.
 */
export async function getAccount(config: SessionConfig): Promise<WalletAccount> {
  const p = getProvider(config);
  const account = await p.connect();
  if (!account) {
    throw new Error(
      "Cartridge session not established. Open the printed URL in a browser to authorize.",
    );
  }
  return account;
}
