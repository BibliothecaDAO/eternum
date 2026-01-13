import { useMemo, useState } from "react";
import { useTransactionStore, type Transaction } from "@/hooks/store/use-transaction-store";
import { TransactionItem } from "./transaction-item";

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: "default" | "warning" | "error";
}

const CollapsibleSection = ({
  title,
  count,
  children,
  defaultExpanded = true,
  variant = "default",
}: CollapsibleSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (count === 0) return null;

  const variantStyles = {
    default: "text-gold/70",
    warning: "text-orange",
    error: "text-danger",
  };

  return (
    <div className="border-b border-gold/10 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gold/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-gold/50 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-xs font-medium ${variantStyles[variant]}`}>{title}</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            variant === "error"
              ? "bg-danger/20 text-danger"
              : variant === "warning"
                ? "bg-orange/20 text-orange"
                : "bg-gold/20 text-gold/70"
          }`}
        >
          {count}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

interface TransactionListProps {
  maxRecentTransactions?: number;
}

export const TransactionList = ({ maxRecentTransactions = 10 }: TransactionListProps) => {
  const transactions = useTransactionStore((state) => state.transactions);
  const stuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);
  const clearCompletedTransactions = useTransactionStore((state) => state.clearCompletedTransactions);

  const { pendingTxs, stuckTxs, recentTxs, stuckHashes } = useMemo(() => {
    const now = Date.now();

    const pending: Transaction[] = [];
    const stuck: Transaction[] = [];
    const completed: Transaction[] = [];
    const stuckHashSet = new Set<string>();

    for (const tx of transactions) {
      if (tx.status === "pending") {
        const isStuck = now - tx.submittedAt >= stuckThresholdMs;
        if (isStuck) {
          stuck.push(tx);
          stuckHashSet.add(tx.hash);
        } else {
          pending.push(tx);
        }
      } else {
        completed.push(tx);
      }
    }

    // Sort stuck by how long they've been waiting (longest first)
    stuck.sort((a, b) => a.submittedAt - b.submittedAt);

    // Sort pending by most recent first
    pending.sort((a, b) => b.submittedAt - a.submittedAt);

    // Sort completed by most recent first, limit to maxRecentTransactions
    completed.sort((a, b) => (b.confirmedAt ?? b.submittedAt) - (a.confirmedAt ?? a.submittedAt));
    const recent = completed.slice(0, maxRecentTransactions);

    return {
      pendingTxs: pending,
      stuckTxs: stuck,
      recentTxs: recent,
      stuckHashes: stuckHashSet,
    };
  }, [transactions, stuckThresholdMs, maxRecentTransactions]);

  const hasCompletedTransactions = transactions.some((t) => t.status !== "pending");

  if (transactions.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-2xl mb-2">
          <span role="img" aria-label="sparkles">
            ✨
          </span>
        </div>
        <p className="text-sm text-gold/50">No transactions yet</p>
        <p className="text-xs text-gold/30 mt-1">Your transaction history will appear here</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
      {/* Stuck transactions (warning state) */}
      <CollapsibleSection
        title="Stuck Transactions"
        count={stuckTxs.length}
        variant="warning"
        defaultExpanded={true}
      >
        <div className="space-y-px">
          {stuckTxs.map((tx) => (
            <TransactionItem key={tx.hash} transaction={tx} isStuck={true} />
          ))}
        </div>
        {/* Refresh button for stuck transactions */}
        <div className="px-3 py-2 border-t border-orange/20">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2
                       bg-orange/20 hover:bg-orange/30
                       border border-orange/40 rounded
                       text-orange text-xs font-medium
                       transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Client
          </button>
          <p className="text-[10px] text-orange/50 text-center mt-1">
            Try refreshing if transactions are stuck
          </p>
        </div>
      </CollapsibleSection>

      {/* Pending transactions */}
      <CollapsibleSection title="Pending" count={pendingTxs.length} defaultExpanded={true}>
        <div className="space-y-px">
          {pendingTxs.map((tx) => (
            <TransactionItem key={tx.hash} transaction={tx} isStuck={stuckHashes.has(tx.hash)} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Recent transactions (completed) */}
      <CollapsibleSection
        title="Recent"
        count={recentTxs.length}
        defaultExpanded={pendingTxs.length === 0 && stuckTxs.length === 0}
      >
        <div className="space-y-px">
          {recentTxs.map((tx) => (
            <TransactionItem key={tx.hash} transaction={tx} isStuck={false} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Clear completed button */}
      {hasCompletedTransactions && (
        <div className="px-3 py-2 border-t border-gold/10">
          <button
            onClick={clearCompletedTransactions}
            className="w-full text-xs text-gold/40 hover:text-gold/70 transition-colors py-1"
          >
            Clear completed transactions
          </button>
        </div>
      )}
    </div>
  );
};
