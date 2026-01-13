import { useEffect } from "react";
import { TransactionType } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { getTxMessage } from "@/ui/components/transaction-center/types";

interface TransactionSubmittedPayload {
  transactionHash: string;
  type: TransactionType;
  transactionCount?: number;
}

interface TransactionPendingPayload {
  transactionHash: string;
  type: TransactionType;
  transactionCount?: number;
}

interface TransactionCompletePayload {
  details: {
    transaction_hash: string;
    // Other fields from GetTransactionReceiptResponse
  };
  type: TransactionType;
  transactionCount?: number;
}

interface TransactionFailedPayload {
  message?: string;
  type?: TransactionType;
  transactionCount?: number;
  transactionHash?: string;
}

export const useTransactionListener = () => {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransaction = useTransactionStore((state) => state.updateTransaction);

  useEffect(() => {
    // Called immediately when transaction is submitted to the network
    const handleTransactionSubmitted = (payload: TransactionSubmittedPayload) => {
      addTransaction({
        hash: payload.transactionHash,
        type: payload.type,
        status: "pending",
        description: getTxMessage(payload.type),
        transactionCount: payload.transactionCount,
      });
    };

    // Called if transaction is still pending after timeout (10s)
    // We already added it in handleTransactionSubmitted, so just ensure it exists
    const handleTransactionPending = (payload: TransactionPendingPayload) => {
      const existingTx = useTransactionStore.getState().transactions.find((t) => t.hash === payload.transactionHash);
      if (!existingTx) {
        addTransaction({
          hash: payload.transactionHash,
          type: payload.type,
          status: "pending",
          description: getTxMessage(payload.type),
          transactionCount: payload.transactionCount,
        });
      }
    };

    const handleTransactionComplete = (payload: TransactionCompletePayload) => {
      const hash = payload.details.transaction_hash;

      // First try to update existing transaction
      const existingTx = useTransactionStore.getState().transactions.find((t) => t.hash === hash);

      if (existingTx) {
        updateTransaction(hash, {
          status: "success",
          confirmedAt: Date.now(),
        });
      } else {
        // If transaction wasn't tracked (completed quickly before pending event),
        // add it as a completed transaction
        addTransaction({
          hash,
          type: payload.type,
          status: "success",
          description: getTxMessage(payload.type),
          transactionCount: payload.transactionCount,
          confirmedAt: Date.now(),
        });
      }
    };

    const handleTransactionFailed = (error: string | TransactionFailedPayload, meta?: TransactionFailedPayload) => {
      // Parse the error payload (can be string or object)
      const message =
        typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "Transaction failed";

      const type = typeof error === "object" && error?.type ? error.type : (meta?.type ?? null);

      const transactionHash =
        typeof error === "object" && error?.transactionHash ? error.transactionHash : (meta?.transactionHash ?? null);

      const transactionCount =
        typeof error === "object" && error?.transactionCount
          ? error.transactionCount
          : (meta?.transactionCount ?? undefined);

      if (transactionHash) {
        // Try to update existing transaction
        const existingTx = useTransactionStore.getState().transactions.find((t) => t.hash === transactionHash);

        if (existingTx) {
          updateTransaction(transactionHash, {
            status: "reverted",
            confirmedAt: Date.now(),
            errorMessage: message,
          });
        } else if (type) {
          // Add as failed transaction if we have the type
          addTransaction({
            hash: transactionHash,
            type,
            status: "reverted",
            description: getTxMessage(type),
            transactionCount,
            confirmedAt: Date.now(),
            errorMessage: message,
          });
        }
      }
    };

    provider.on("transactionSubmitted", handleTransactionSubmitted);
    provider.on("transactionPending", handleTransactionPending);
    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionSubmitted", handleTransactionSubmitted);
      provider.off("transactionPending", handleTransactionPending);
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed);
    };
  }, [provider, addTransaction, updateTransaction]);
};
