import { useDojo } from "@/hooks/context/DojoContext";
import { useEffect } from "react";
import { toast } from "sonner";

export function TransactionNotification() {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();
  useEffect(() => {
    const handleTransactionComplete = (receipt: any) => {
      console.log("Transaction completed:", receipt);
      toast("Completed Action", { description: receipt.transactionHash });
    };

    const handleTransactionFailed = (error: string) => {
      console.error("Transaction failed:", error);
      toast("Transaction failed");
    };

    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed);
    };
  }, [provider]);

  return null;
}
