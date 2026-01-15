import { TransactionType } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { getTxMessage as getBaseMessage, getTxIcon } from "@/ui/components/transaction-center/types";

const getTxMessage = (type: TransactionType): string => {
  const icon = getTxIcon(type);
  const message = getBaseMessage(type);
  return `${icon} ${message}`;
};

type TransactionFailurePayload = {
  message?: string;
  type?: (typeof TransactionType)[keyof typeof TransactionType];
  transactionCount?: number;
  transactionHash?: string;
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
    };

    const handleTransactionComplete = (receipt: any) => {
      console.log("Transaction completed:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("Completed Action", { description: description + txCount });
    };

    const handleTransactionFailed = (error: string | TransactionFailurePayload, meta?: TransactionFailurePayload) => {
      const message =
        typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "Transaction failed.";
      const type =
        typeof error === "object" && error?.type ? error.type : typeof meta?.type !== "undefined" ? meta.type : null;
      const transactionCount =
        typeof error === "object" && error?.transactionCount
          ? error.transactionCount
          : typeof meta?.transactionCount === "number"
            ? meta.transactionCount
            : null;
      const action = type ? getTxMessage(type) : "Action failed";
      const txCount = transactionCount ? ` (${transactionCount} transactions)` : "";
      const description = `${action}${txCount} - ${message}`;
      console.error("Transaction failed:", message);
      toast("❌ Transaction failed", { description });
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
