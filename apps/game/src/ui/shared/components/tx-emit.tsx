import {
  classifyTransactionError,
  SUBMISSION_TIMEOUT_UNCERTAIN_MESSAGE,
  TransactionType,
  type ClassifiedTransactionError,
} from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AudioManager } from "@/audio/core/AudioManager";
import { getTxMessage as getBaseMessage, getTxIcon } from "@/ui/components/transaction-center/types";
import { verboseLog } from "@/utils/dev-mode";
import { extractReadableErrorMessage, formatReadableErrorForConsole } from "@/utils/error-message";

const getTxMessage = (type: TransactionType): string => {
  const icon = getTxIcon(type);
  const message = getBaseMessage(type);
  return `${icon} ${message}`;
};

type TransactionFailurePayload = {
  message?: string;
  type?: (typeof TransactionType)[keyof typeof TransactionType];
  stage?: string;
  transactionCount?: number;
  transactionHash?: string;
  failureKind?: string;
  error?: unknown;
  errorCode?: number;
  revertReason?: string;
};

const resolveFailureReason = (payload: TransactionFailurePayload, classified: ClassifiedTransactionError): string => {
  if (classified.reason) {
    return classified.reason;
  }
  if (payload.revertReason) {
    const readableRevertReason = extractReadableErrorMessage(payload.revertReason, "");
    if (readableRevertReason) {
      return readableRevertReason;
    }
  }
  return extractReadableErrorMessage(payload.message, "Transaction failed.");
};

export function TransactionNotification() {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  useEffect(() => {
    const handleTransactionPending = (receipt: any) => {
      verboseLog("Transaction pending:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("⏳ Transaction pending", { description: description + txCount });
      AudioManager.getInstance().play("ui.toast_info");
    };

    const handleTransactionComplete = (receipt: any) => {
      verboseLog("Transaction completed:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("Completed Action", { description: description + txCount });
      AudioManager.getInstance().play("ui.tx_success");
    };

    const handleTransactionFailed = (payload: TransactionFailurePayload) => {
      const type = typeof payload?.type !== "undefined" ? payload.type : null;
      const transactionCount = typeof payload?.transactionCount === "number" ? payload.transactionCount : null;
      const action = type ? getTxMessage(type) : "Action";
      const txCount = transactionCount ? ` (${transactionCount} transactions)` : "";
      const actionLabel = `${action}${txCount}`;

      if (payload.failureKind === "submission_timeout_no_hash") {
        toast("⚠️ Transaction status uncertain", {
          description: `${actionLabel} - ${SUBMISSION_TIMEOUT_UNCERTAIN_MESSAGE}`,
        });
        AudioManager.getInstance().play("ui.tx_fail");
        return;
      }

      // Payloads always carry `error` since the provider attaches it; fall back
      // to the message string only for payloads emitted without one.
      const classified = classifyTransactionError("error" in payload ? payload.error : payload.message);

      if (classified.kind === "user_cancelled") {
        verboseLog("Transaction cancelled by user:", payload.type);
        // No failure sound: closing the wallet popup is not an error.
        toast("Transaction cancelled", { description: actionLabel });
        return;
      }

      const reason = resolveFailureReason(payload, classified);
      const consoleReason = formatReadableErrorForConsole(payload.error ?? payload.message, reason);
      console.error(`Transaction failed: ${consoleReason}`);

      if (classified.kind === "session_invalid") {
        toast("⚠️ Gameplay key expired", {
          description: `${actionLabel}: Reload to recover your gameplay account`,
        });
      } else if (classified.kind === "insufficient_funds") {
        const fundsDetail = classified.reason ? ` — ${classified.reason}` : "";
        toast("❌ Insufficient funds", {
          description: `${actionLabel}: Not enough funds to cover this transaction${fundsDetail}`,
        });
      } else if (classified.kind === "reverted") {
        toast("❌ Transaction failed", { description: `${actionLabel} failed: ${reason}` });
      } else {
        toast("❌ Transaction failed", { description: `${actionLabel} - ${reason}` });
      }
      AudioManager.getInstance().play("ui.tx_fail");
    };

    provider.on("transactionPending", handleTransactionPending);
    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionPending", handleTransactionPending);
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed);
    };
  }, [provider]);

  return null;
}
