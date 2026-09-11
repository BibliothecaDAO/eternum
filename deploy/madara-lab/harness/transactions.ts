import type { Account, Call } from "starknet";
import { resolveGameTransactionResourceBounds } from "../../../packages/core/src/account/transaction-resource-bounds";

export async function executeMadaraAndWait(account: Account, calls: Call | Call[], label: string): Promise<string> {
  const transaction = await account.execute(calls, {
    resourceBounds: resolveGameTransactionResourceBounds("madara"),
    tip: 0,
  });
  const receipt = await account.waitForTransaction(transaction.transaction_hash, { retryInterval: 50 });
  const status = receipt as { execution_status?: string; isSuccess?: () => boolean };
  const succeeded =
    typeof status.isSuccess === "function" ? status.isSuccess() : status.execution_status === "SUCCEEDED";
  if (!succeeded) throw new Error(`${label} failed for transaction ${transaction.transaction_hash}`);
  return transaction.transaction_hash;
}
