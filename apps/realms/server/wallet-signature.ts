import type { SiwsTypedData, WalletDeployment } from "@realms-world/identity";
import { verifyUndeployedProof } from "./undeployed-proof";
import { RpcError, RpcProvider, verifyMessageInStarknet } from "starknet";
import { identityL2Configuration, identityProvider, verifyIdentityChain } from "./l2";

/** Deployed wallets use their confirmed environment-chain contract; absent wallets require bound deployment data. */
export type VerifyWalletSignature = (
  message: SiwsTypedData,
  signature: string[],
  address: string,
  deployment?: WalletDeployment,
) => Promise<boolean>;

export class WalletNotDeployedError extends Error {}

/** Offchain verification is allowed only after the environment chain explicitly reports that the account is absent. */
export const verifyWalletOnL2 =
  (env: {
    ENVIRONMENT: import("@realms-world/chain").ValueEnvironment;
    IDENTITY_RPC_URL: string;
  }): VerifyWalletSignature =>
  async (message, signature, address, deployment) => {
    const { chainId } = identityL2Configuration(env);
    if (message.domain.chainId !== chainId) throw new Error("identity_proof_chain_mismatch");
    const provider = identityProvider(env);
    await verifyIdentityChain(provider, env);
    try {
      return await verifyMessageInStarknet(
        provider,
        message as unknown as Parameters<typeof verifyMessageInStarknet>[1],
        signature,
        address,
      );
    } catch (error) {
      if (!(await isUndeployedWallet(provider, address))) throw error;
      if (!deployment) throw new WalletNotDeployedError("Wallet is not deployed on the environment chain");
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
