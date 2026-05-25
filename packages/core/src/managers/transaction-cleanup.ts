type TransactionWaiter = (transactionHash: string) => Promise<unknown>;

interface ScheduleTransactionCleanupArgs {
  signer: unknown;
  result: unknown;
  cleanup: () => void;
  fallbackTimeoutMs: number;
}

export const scheduleTransactionCleanup = ({
  signer,
  result,
  cleanup,
  fallbackTimeoutMs,
}: ScheduleTransactionCleanupArgs) => {
  const transactionHash = extractTransactionHash(result);
  const waitForTransaction = resolveTransactionWaiter(signer);

  if (!transactionHash || !waitForTransaction) {
    cleanup();
    return;
  }

  let cleanedUp = false;
  const finalize = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanup();
  };

  const fallbackTimeout = setTimeout(finalize, fallbackTimeoutMs);
  if (typeof fallbackTimeout === "object" && typeof fallbackTimeout.unref === "function") {
    fallbackTimeout.unref();
  }

  let waitForTransactionPromise: Promise<unknown>;
  try {
    waitForTransactionPromise = waitForTransaction(transactionHash);
  } catch {
    clearTimeout(fallbackTimeout);
    finalize();
    return;
  }

  void waitForTransactionPromise
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(fallbackTimeout);
      finalize();
    });
};

const extractTransactionHash = (result: unknown): string | undefined => {
  const transaction = result as { transaction_hash?: unknown; transactionHash?: unknown } | undefined;
  const transactionHash = transaction?.transaction_hash ?? transaction?.transactionHash;
  return typeof transactionHash === "string" ? transactionHash : undefined;
};

const resolveTransactionWaiter = (signer: unknown): TransactionWaiter | null => {
  const signerWithWaiters = signer as
    | {
        waitForTransaction?: TransactionWaiter;
        waitForTransactionWithCheck?: TransactionWaiter;
        provider?: {
          waitForTransaction?: TransactionWaiter;
          waitForTransactionWithCheck?: TransactionWaiter;
        };
      }
    | undefined;

  if (typeof signerWithWaiters?.provider?.waitForTransactionWithCheck === "function") {
    return signerWithWaiters.provider.waitForTransactionWithCheck.bind(signerWithWaiters.provider);
  }

  if (typeof signerWithWaiters?.waitForTransactionWithCheck === "function") {
    return signerWithWaiters.waitForTransactionWithCheck.bind(signerWithWaiters);
  }

  if (typeof signerWithWaiters?.waitForTransaction === "function") {
    return signerWithWaiters.waitForTransaction.bind(signerWithWaiters);
  }

  if (typeof signerWithWaiters?.provider?.waitForTransaction === "function") {
    return signerWithWaiters.provider.waitForTransaction.bind(signerWithWaiters.provider);
  }

  return null;
};
