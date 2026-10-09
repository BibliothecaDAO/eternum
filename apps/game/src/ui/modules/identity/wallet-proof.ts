import {
  IdentityRequestError,
  type SignInOptions,
  type SiwsTypedData,
  type WalletDeployment,
} from "@realms-world/identity";
import {
  RpcError,
  addAddressPadding,
  stark,
  type AccountInterface,
  type ProviderInterface,
  type Signature,
  type WalletAccount,
} from "starknet";

/** Deployment data comes from the chosen wallet; the server independently reconstructs and verifies its authority. */
export const walletProofForAccount = async (
  account: AccountInterface,
  provider: ProviderInterface,
  connectorId: string,
): Promise<SignInOptions> => {
  const undeployed = await isUndeployed(provider, account.address);
  const deployment = undeployed ? await walletDeployment(account) : undefined;
  const signTypedData =
    undeployed && connectorId === "argentX"
      ? readyUndeployedSigner(account)
      : async (message: SiwsTypedData) =>
          stark.formatSignature(await account.signMessage(message as Parameters<typeof account.signMessage>[0]));
  return {
    address: addAddressPadding(account.address),
    chainId: "SN_MAIN",
    domain: window.location.host,
    uri: window.location.origin,
    signTypedData,
    ...(deployment ? { deployment } : {}),
  };
};

const isUndeployed = async (provider: ProviderInterface, address: string) => {
  try {
    await provider.getClassHashAt(address, "latest");
    return false;
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND")) return true;
    throw error;
  }
};
const walletDeployment = async (account: AccountInterface): Promise<WalletDeployment> => {
  try {
    const wallet = (account as WalletAccount).walletProvider;
    const data = await wallet.request({ type: "wallet_deploymentData" });
    return deploymentPayload(data);
  } catch {
    throw new IdentityRequestError(400, "WALLET_NOT_DEPLOYED");
  }
};

/** The wallet API uses snake case; Ready also documents its earlier SDK deployment-payload shape. */
const deploymentPayload = (raw: unknown): WalletDeployment => {
  if (!raw || typeof raw !== "object") throw new Error("missing_deployment_data");
  const data = raw as Record<string, unknown>;
  const standard = "class_hash" in data;
  const classHash = standard ? data.class_hash : data.classHash;
  const salt = standard ? data.salt : data.addressSalt;
  const calldata = standard ? data.calldata : data.constructorCalldata;
  if (!Array.isArray(calldata) || typeof classHash !== "string" || (standard && "classHash" in data))
    throw new Error("unsupported_deployment_data");
  return { classHash, salt: deploymentValue(salt), constructorCalldata: calldata.map(deploymentValue) };
};
const deploymentValue = (value: unknown): string => {
  if (typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) return value;
  if (typeof value === "bigint" && value >= 0n) return String(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new Error("unserialized_deployment_value");
};

/** Ready documents skipDeploy on its native account, which the connector's SDK wrapper does not forward. */
const readyUndeployedSigner = (account: AccountInterface) => {
  const wallet = (account as WalletAccount).walletProvider as unknown as {
    account?: { signMessage(message: SiwsTypedData, options: { skipDeploy: true }): Promise<Signature> };
  };
  if (typeof wallet.account?.signMessage !== "function") throw new IdentityRequestError(400, "WALLET_NOT_DEPLOYED");
  const nativeAccount = wallet.account;
  return async (message: SiwsTypedData) =>
    stark.formatSignature(await nativeAccount.signMessage(message, { skipDeploy: true }));
};
