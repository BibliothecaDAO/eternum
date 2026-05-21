const AUTOMATION_RESOURCE_CLEANUP_FALLBACK_MS = 55_000;

type TransactionWaiter = (transactionHash: string) => Promise<unknown>;

interface ScheduleAutomationResourceCleanupArgs {
  signer: unknown;
  result: unknown;
  cleanup: () => void;
  fallbackTimeoutMs?: number;
}

export const scheduleAutomationResourceCleanup = ({
  signer,
  result,
  cleanup,
  fallbackTimeoutMs = AUTOMATION_RESOURCE_CLEANUP_FALLBACK_MS,
}: ScheduleAutomationResourceCleanupArgs) => {
  const transactionHash = extractTransactionHash(result);
  const waitForTransaction = resolveTransactionWaiter(signer);

  if (!transactionHash) {
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

  if (!waitForTransaction) {
    return;
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
