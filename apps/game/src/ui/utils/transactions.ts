export const extractTransactionHash = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;

  const maybeHash = (value as { transaction_hash?: unknown }).transaction_hash;
  return typeof maybeHash === "string" && maybeHash.length > 0 ? maybeHash : null;
};

export const resolveTransactionFromGameStream = async ({ txHash, label }: { txHash: string; label?: string }) => {
  const runtime = getActiveGameSyncRuntime();
  if (!runtime?.hasTransactionStatusChannel()) return;
  await runtime.waitForTransaction(txHash).catch((error) => {
    const transactionLabel = label ?? "transaction";
    throw new Error(`${transactionLabel} failed: ${error instanceof Error ? error.message : String(error)}`);
  });
};
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
