import { SUBMISSION_TIMEOUT_UNCERTAIN_MESSAGE, TransactionType } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AudioManager } from "@/audio/core/AudioManager";
import { getTxMessage as getBaseMessage, getTxIcon } from "@/ui/components/transaction-center/types";
import { extractReadableErrorMessage } from "@/utils/error-message";

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
};

export function TransactionNotification() {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  useEffect(() => {
    const handleTransactionPending = (receipt: any) => {
      console.log("Transaction pending:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("⏳ Transaction pending", { description: description + txCount });
      AudioManager.getInstance().play("ui.toast_info");
    };

    const handleTransactionComplete = (receipt: any) => {
      console.log("Transaction completed:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("Completed Action", { description: description + txCount });
      AudioManager.getInstance().play("ui.tx_success");
    };

    const handleTransactionFailed = (payload: TransactionFailurePayload) => {
      const message = extractReadableErrorMessage(payload.message, "Transaction failed.");
      const type = typeof payload?.type !== "undefined" ? payload.type : null;
      const transactionCount = typeof payload?.transactionCount === "number" ? payload.transactionCount : null;
      const action = type ? getTxMessage(type) : "Action failed";
      const txCount = transactionCount ? ` (${transactionCount} transactions)` : "";
      const isNoHashTimeout = payload.failureKind === "submission_timeout_no_hash";
      const title = isNoHashTimeout ? "⚠️ Transaction status uncertain" : "❌ Transaction failed";
      const description = `${action}${txCount} - ${isNoHashTimeout ? SUBMISSION_TIMEOUT_UNCERTAIN_MESSAGE : message}`;
      console.error("Transaction failed:", message);
      toast(title, { description });
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
