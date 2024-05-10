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
      let rawErrorString = data.toString();
      // Regex to capture exact error message
      const regex = /\('([^']+)'\)/;
      const match = rawErrorString.match(regex);
      if (match) {
        const errorMessage = match[1];
        setFailedTransactions(errorMessage);
        console.log(errorMessage);
      } else {
        setFailedTransactions(rawErrorString);
      }

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
    <div style={{ zIndex: 100 }}>
      {transactions.map((transaction, index) => (
        <div className={`${transaction.execution_status == "REVERTED" ? "text-red/40" : "text-green/70"}`} key={index}>
          Status: {transaction.execution_status} {shortenHex(transaction.transaction_hash)}
        </div>
      ))}

      {failedTransactions && <div className="w-72 text-red text-xxl p-3 text-bold">Failed: {failedTransactions}</div>}
    </div>
  );
};
