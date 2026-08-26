import { Account, type RpcProvider } from "starknet";

interface AppchainFaucetCredentials {
  address: string | undefined;
  privateKey: string | undefined;
}

export function createAppchainFaucetAccount(rpcProvider: RpcProvider, credentials: AppchainFaucetCredentials): Account {
  if (!credentials.address || !credentials.privateKey) {
    throw new Error("Appchain fee-token faucet credentials are not configured.");
  }
  return new Account({
    provider: rpcProvider,
    address: credentials.address,
    signer: credentials.privateKey,
  });
}
