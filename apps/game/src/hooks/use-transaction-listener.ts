import { useEffect } from "react";
import {
  classifyTransactionError,
  TransactionFailedPayload,
  TransactionLifecycleMeta,
  TransactionType,
} from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import {
  addClientTransactionBreadcrumb,
  reportClientTransactionFailure,
} from "@/observability/transaction-failure-reporting";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { getTxMessage } from "@/ui/components/transaction-center/types";
import { clearUncertainClaimSharePointsSubmission } from "@/ui/utils/uncertain-transaction-registry";
import { extractReadableErrorMessage } from "@/utils/error-message";

interface TransactionSubmittedPayload extends TransactionLifecycleMeta {
  transactionHash: string;
  type: TransactionType;
}

interface TransactionPendingPayload extends TransactionLifecycleMeta {
  transactionHash: string;
  type: TransactionType;
}

interface TransactionCompletePayload extends TransactionLifecycleMeta {
  details: {
    transaction_hash: string;
    // Other fields from GetTransactionReceiptResponse
  };
  type: TransactionType;
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
    const clearRecoveredClaimSharePointsMarker = (payload: TransactionLifecycleMeta) => {
      if (
        payload.recoveredFromSubmissionTimeout &&
        payload.type === TransactionType.CLAIM_SHARE_POINTS &&
        payload.signerAddress
      ) {
        clearUncertainClaimSharePointsSubmission(payload.signerAddress);
      }
    };

    // Called immediately when transaction is submitted to the network
    const handleTransactionSubmitted = (payload: TransactionSubmittedPayload) => {
      addClientTransactionBreadcrumb({
        stage: "submitted",
        message: payload.type ? getTxMessage(payload.type) : "Transaction submitted",
        context: {
          surface: "dojo_provider",
          operation: payload.type ?? "transaction_submitted",
          stage: "submit",
          transactionType: payload.type,
          transactionHash: payload.transactionHash,
          transactionCount: payload.transactionCount,
          batchDetails: payload.batchDetails,
          entrypoints: payload.entrypoints,
          contractAddresses: payload.contractAddresses,
        },
      });
      addTransaction({
        hash: payload.transactionHash,
        type: payload.type,
        status: "pending",
        description: getTxMessage(payload.type),
        transactionCount: payload.transactionCount,
        batchDetails: payload.batchDetails,
      });
    };

    // Called if transaction is still pending after timeout (10s)
    // We already added it in handleTransactionSubmitted, so just ensure it exists
    const handleTransactionPending = (payload: TransactionPendingPayload) => {
      addClientTransactionBreadcrumb({
        stage: "pending",
        message: payload.type ? getTxMessage(payload.type) : "Transaction pending",
        context: {
          surface: "dojo_provider",
          operation: payload.type ?? "transaction_pending",
          stage: "background_confirmation",
          transactionType: payload.type,
          transactionHash: payload.transactionHash,
          transactionCount: payload.transactionCount,
          batchDetails: payload.batchDetails,
          entrypoints: payload.entrypoints,
          contractAddresses: payload.contractAddresses,
        },
      });
      const existingTx = useTransactionStore.getState().transactions.find((t) => t.hash === payload.transactionHash);
      if (!existingTx) {
        addTransaction({
          hash: payload.transactionHash,
          type: payload.type,
          status: "pending",
          description: getTxMessage(payload.type),
          transactionCount: payload.transactionCount,
          batchDetails: payload.batchDetails,
        });
      }
    };

    const handleTransactionComplete = (payload: TransactionCompletePayload) => {
      const hash = payload.details.transaction_hash;
      clearRecoveredClaimSharePointsMarker(payload);
      addClientTransactionBreadcrumb({
        stage: "completed",
        message: payload.type ? getTxMessage(payload.type) : "Transaction completed",
        context: {
          surface: "dojo_provider",
          operation: payload.type ?? "transaction_complete",
          stage: "confirmation",
          transactionType: payload.type,
          transactionHash: hash,
          transactionCount: payload.transactionCount,
          batchDetails: payload.batchDetails,
          entrypoints: payload.entrypoints,
          contractAddresses: payload.contractAddresses,
        },
      });

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
          batchDetails: payload.batchDetails,
          confirmedAt: Date.now(),
        });
      }
    };

    const handleTransactionFailed = (payload: TransactionFailedPayload) => {
      // Payloads carry the original error since the provider attaches it; the
      // message string is the fallback for payloads emitted without one.
      const classified = classifyTransactionError("error" in payload ? payload.error : payload.message);
      const message =
        classified.reason ?? extractReadableErrorMessage(payload.revertReason ?? payload.message, "Transaction failed");
      clearRecoveredClaimSharePointsMarker(payload);
      void reportClientTransactionFailure({
        error: payload.error ?? new Error(message),
        context: {
          surface: "dojo_provider",
          operation: payload.type ?? "provider_transaction_failure",
          stage: classified.kind === "user_cancelled" ? "wallet_rejected" : payload.stage,
          transactionType: payload.type,
          transactionHash: payload.transactionHash,
          transactionCount: payload.transactionCount,
          batchDetails: payload.batchDetails,
          entrypoints: payload.entrypoints,
          contractAddresses: payload.contractAddresses,
          failureKind: payload.failureKind,
          providerState: payload.providerState,
          hasTxHash: payload.hasTxHash ?? Boolean(payload.transactionHash),
          retrySafety: payload.retrySafety,
        },
      });

      if (payload.transactionHash) {
        // Try to update existing transaction
        const existingTx = useTransactionStore.getState().transactions.find((t) => t.hash === payload.transactionHash);

        if (existingTx) {
          updateTransaction(payload.transactionHash, {
            status: "reverted",
            confirmedAt: Date.now(),
            errorMessage: message,
          });
        } else if (payload.type) {
          // Add as failed transaction if we have the type
          addTransaction({
            hash: payload.transactionHash,
            type: payload.type,
            status: "reverted",
            description: getTxMessage(payload.type),
            transactionCount: payload.transactionCount,
            batchDetails: payload.batchDetails,
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
