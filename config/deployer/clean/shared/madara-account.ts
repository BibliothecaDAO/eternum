import { Account, legacyDeployer, type RpcProvider } from "starknet";

export function createMadaraAccount(provider: RpcProvider, address: string, signer: string): Account {
  // The lab genesis contains the original UDC, not Starknet.js's newer default.
  return new Account({ provider, address, signer, deployer: legacyDeployer });
}
