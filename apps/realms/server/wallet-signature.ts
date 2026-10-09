import type { SiwsTypedData, WalletDeployment } from "@realms-world/identity";
import { verifyUndeployedProof } from "./undeployed-proof";
import { RpcError, RpcProvider, verifyMessageInStarknet } from "starknet";

/** Deployed wallets use their confirmed mainnet contract; absent wallets require bound deployment data. */
export type VerifyWalletSignature = (
  message: SiwsTypedData,
  signature: string[],
  address: string,
  deployment?: WalletDeployment,
) => Promise<boolean>;

export class WalletNotDeployedError extends Error {}

/** Offchain verification is allowed only after mainnet explicitly reports that the account is absent. */
export const verifyWalletOnMainnet =
  (rpcUrl: string): VerifyWalletSignature =>
  async (message, signature, address, deployment) => {
    const provider = new RpcProvider({ nodeUrl: rpcUrl, blockIdentifier: "latest" });
    try {
      return await verifyMessageInStarknet(
        provider,
        message as unknown as Parameters<typeof verifyMessageInStarknet>[1],
        signature,
        address,
      );
    } catch (error) {
      if (!(await isUndeployedWallet(provider, address))) throw error;
      if (!deployment) throw new WalletNotDeployedError("Wallet is not deployed on Starknet mainnet");
      return verifyUndeployedProof(message, signature, address, deployment);
    }
  };

const isUndeployedWallet = async (provider: RpcProvider, address: string): Promise<boolean> => {
  try {
    await provider.getClassHashAt(address);
    return false;
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND")) return true;
    throw error;
  }
};
