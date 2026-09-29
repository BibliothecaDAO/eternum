import type { SiwsTypedData } from "@realms-world/identity";
import { RpcError, RpcProvider, verifyMessageInStarknet } from "starknet";

/** Checks a wallet's signature using its mainnet contract. */
export type VerifyWalletSignature = (message: SiwsTypedData, signature: string[], address: string) => Promise<boolean>;

export class WalletNotDeployedError extends Error {}

/** Preserve a recoverable deployment refusal despite the SDK wrapping signature errors as plain Error objects. */
export const verifyWalletOnMainnet =
  (rpcUrl: string): VerifyWalletSignature =>
  async (message, signature, address) => {
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    try {
      return await verifyMessageInStarknet(
        provider,
        message as unknown as Parameters<typeof verifyMessageInStarknet>[1],
        signature,
        address,
      );
    } catch (error) {
      await requireDeployedWallet(provider, address);
      throw error;
    }
  };

const requireDeployedWallet = async (provider: RpcProvider, address: string): Promise<void> => {
  try {
    await provider.getClassHashAt(address);
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND"))
      throw new WalletNotDeployedError("Wallet is not deployed on Starknet mainnet");
    throw error;
  }
};
