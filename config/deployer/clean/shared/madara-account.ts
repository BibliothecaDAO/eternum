import { DeviceSigner, deviceKeyOf } from "@bibliothecadao/eternum";
import { Account, legacyDeployer, type RpcProvider } from "starknet";

export function createMadaraAccount(provider: RpcProvider, address: string, signer: string): Account {
  // The lab genesis contains the original UDC, not Starknet.js's newer default.
  return new Account({ provider, address, signer, deployer: legacyDeployer });
}

/** The shard operator's Realms account, signed by its one device: the deployer key, under the shard's guardian. */
export function createOperatorAccount(provider: RpcProvider, address: string, privateKey: string): Account {
  return new Account({
    provider,
    address,
    signer: new DeviceSigner(deviceKeyOf(privateKey)),
    cairoVersion: "1",
    deployer: legacyDeployer,
  });
}
