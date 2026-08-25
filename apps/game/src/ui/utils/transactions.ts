export const extractTransactionHash = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;

  const maybeHash = (value as { transaction_hash?: unknown }).transaction_hash;
  return typeof maybeHash === "string" && maybeHash.length > 0 ? maybeHash : null;
};

type WaitCapableProvider = {
  waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
};

type WaitCapableAccount = {
  waitForTransaction?: (txHash: string) => Promise<unknown>;
};

export const waitForTransactionConfirmation = async ({
  txHash,
  provider,
  account,
  label,
}: {
  txHash: string;
  provider?: WaitCapableProvider;
  account?: WaitCapableAccount;
  label?: string;
}) => {
  if (provider && typeof provider.waitForTransactionWithCheck === "function") {
    await provider.waitForTransactionWithCheck(txHash);
    return;
  }

  if (account && typeof account.waitForTransaction === "function") {
    await account.waitForTransaction(txHash);
    return;
  }

  const transactionLabel = label ?? "transaction";
  throw new Error(`Unable to confirm ${transactionLabel}: no transaction wait method available`);
};
