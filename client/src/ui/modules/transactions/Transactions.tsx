import { useDojo } from "@/hooks/context/DojoContext";
import { shortenHex } from "@dojoengine/utils";
import { useEffect, useState } from "react";

export const Transactions = () => {
  const {
    network: { provider },
  } = useDojo();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [failedTransactions, setFailedTransactions] = useState<any>(null); // New state for failed transactions

  useEffect(() => {
    const handleTransactionComplete = (data: any) => {
      console.log("Transaction completed:", data);
      setTransactions((prevTransactions) => {
        const exists = prevTransactions.some((tx) => tx.transaction_hash === data.transaction_hash);
        if (!exists) {
          setTimeout(() => {
            setTransactions((prevTransactions) =>
              prevTransactions.filter((tx) => tx.transaction_hash !== data.transaction_hash),
            );
          }, 20000);
          return [...prevTransactions, data];
        }
        return prevTransactions;
      });
    };

    const handleTransactionFailed = (data: any) => {
      setFailedTransactions(data.toString());

      setTimeout(() => {
        setFailedTransactions(null);
      }, 10000);
    };

    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed); // Cleanup for transactionFailed
    };
  }, [provider]);

  return (
    <div>
      {transactions.map((transaction, index) => (
        <div className={`${transaction.execution_status == "REVERTED" ? "text-red/40" : "text-green/70"}`} key={index}>
          Status: {transaction.execution_status} {shortenHex(transaction.transaction_hash)}
        </div>
      ))}

      {failedTransactions && <div className="w-72 text-white text-xs p-3">Failed: {failedTransactions}</div>}
    </div>
  );
};
