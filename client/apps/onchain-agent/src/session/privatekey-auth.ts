import { Account, RpcProvider } from "starknet";

/**
 * Create a starknet Account from a private key.
 * Bypasses Cartridge Controller entirely — no session, no paymaster.
 * Useful for fully autonomous headless operation.
 */
export function createPrivateKeyAccount(rpcUrl: string, privateKey: string, address: string): Account {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required for --auth=privatekey");
  }
  if (!address) {
    throw new Error("ACCOUNT_ADDRESS environment variable is required for --auth=privatekey");
  }
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  return new Account({ provider, address, signer: privateKey });
}
