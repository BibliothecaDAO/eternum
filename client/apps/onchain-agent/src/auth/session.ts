/**
 * Cartridge Controller session management for the on-chain agent.
 *
 * Manages a singleton {@link SessionProvider} and exposes {@link getAccount} to
 * obtain an authenticated Starknet WalletAccount. On first use the provider
 * prints a browser-based auth URL; subsequent calls reuse the persisted session.
 */

import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";
import { shortString } from "starknet";
import { buildPolicies, type Chain, type TokenAddresses } from "./policies.js";

/**
 * Configuration required to initialise the Cartridge SessionProvider and connect
 * an authenticated agent wallet.
 */
interface SessionConfig {
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
  /** Pre-loaded manifest (e.g. patched with factory-discovered addresses). */
  manifest?: any;
}

let provider: SessionProvider | null = null;

/**
 * Get or create the SessionProvider singleton.
 *
 * On first call, builds policies from the Dojo manifest for the given chain,
 * creates a SessionProvider, and returns it. Subsequent calls return the
 * same instance.
 */
function getProvider(config: SessionConfig): SessionProvider {
  if (provider) return provider;

  const policies = buildPolicies(config.chain, config.tokens, config.manifest);

  // The WASM session account expects chainId as a felt, not a human-readable
  // string like "SN_MAIN". Encode the short string to its felt hex representation.
  const chainIdFelt = shortString.encodeShortString(config.chainId);

  provider = new SessionProvider({
    rpc: config.rpcUrl,
    chainId: chainIdFelt,
    policies,
    basePath: config.basePath ?? ".cartridge",
  });

  return provider;
}

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Connect and return an authenticated WalletAccount.
 *
 * Initialises the singleton {@link SessionProvider} on first call. If a valid
 * persisted session is found it is returned immediately. Otherwise the SDK
 * prints a browser auth URL and this function polls every 3 seconds until the
 * user completes the authorisation flow or the 5-minute deadline is exceeded.
 *
 * @param config - Session configuration including chain, RPC URL, and optional token addresses.
 * @returns A connected {@link WalletAccount} ready to sign and submit transactions.
 * @throws {Error} If the browser authorisation flow is not completed within 5 minutes.
 * @throws {Error} If `provider.connect()` rejects (network or SDK error).
 */
export async function getAccount(config: SessionConfig): Promise<WalletAccount> {
  const p = getProvider(config);

  // First attempt — may return account immediately if session is valid
  const account = await p.connect();
  if (account) return account;

  // No session — the SDK has printed an auth URL. Poll until the user completes it.
  console.log("\nNo active session. Complete the authorization in your browser.");
  console.log("Waiting for session approval...\n");

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const retryAccount = await p.connect();
    if (retryAccount) {
      console.log("Session established.");
      return retryAccount;
    }
  }

  throw new Error("Session authorization timed out after 5 minutes. Run the agent again to get a new auth URL.");
}
