import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";

export interface ControllerSessionConfig {
  rpcUrl: string;
  chainId: string;
  basePath?: string;
}

// Stub policies — enough to test the auth flow.
// Replace with real Eternum contract policies when wiring up game actions.
const STUB_POLICIES = {
  contracts: {
    "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7": {
      methods: [
        { name: "approve", entrypoint: "approve", description: "Approve token spend" },
        { name: "transfer", entrypoint: "transfer", description: "Transfer tokens" },
      ],
    },
  },
};

export class ControllerSession {
  private provider: SessionProvider;

  constructor(config: ControllerSessionConfig) {
    this.provider = new SessionProvider({
      rpc: config.rpcUrl,
      chainId: config.chainId,
      policies: STUB_POLICIES,
      basePath: config.basePath ?? ".cartridge",
    });
  }

  /**
   * Check for an existing valid session on disk.
   * Returns the account if a session exists and hasn't expired, null otherwise.
   * Does NOT trigger the browser auth flow.
   */
  async probe(): Promise<WalletAccount | null> {
    const account = await this.provider.probe();
    return account ?? null;
  }

  /**
   * Connect to the Cartridge Controller.
   *
   * 1. Checks for an existing session on disk (probe).
   * 2. If none, prints an auth URL to stdout and waits up to 5 minutes
   *    for the human to approve in their browser.
   * 3. Returns the session account once authorized.
   *
   * Throws if the callback times out or the session cannot be established.
   */
  async connect(): Promise<WalletAccount> {
    const account = await this.provider.connect();
    if (!account) {
      throw new Error(
        "Controller session not established. The human must open the printed URL and approve the session.",
      );
    }
    return account;
  }

  /**
   * Clear the stored session. Next connect() will require re-authorization.
   */
  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }
}
