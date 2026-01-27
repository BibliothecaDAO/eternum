import { useEffect, useState, useCallback } from "react";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import {
  getExplorerTxUrl,
  getExplorerName,
  getTxIcon,
  getStatusColor,
  getStatusBorderColor,
  formatTimeAgo,
  truncateHash,
  formatBatchSummary,
  getBatchTotalCount,
  getTxShortLabel,
} from "./types";

interface TransactionItemProps {
  transaction: Transaction;
  isStuck: boolean;
}

export const TransactionItem = ({ transaction, isStuck }: TransactionItemProps) => {
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(transaction.submittedAt));
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this is a batched transaction
  const isBatched = transaction.batchDetails && transaction.batchDetails.length > 0;
  const batchTotalCount = isBatched ? getBatchTotalCount(transaction.batchDetails!) : 0;

  // Update time every second for pending transactions
  useEffect(() => {
    if (transaction.status !== "pending") {
      setTimeAgo(formatTimeAgo(transaction.confirmedAt ?? transaction.submittedAt));
      return;
    }

    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(transaction.submittedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [transaction.status, transaction.submittedAt, transaction.confirmedAt]);

  const handleExplorerClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      window.open(getExplorerTxUrl(transaction.hash), "_blank", "noopener,noreferrer");
    },
    [transaction.hash],
  );

  const handleToggleExpand = useCallback(() => {
    if (isBatched) {
      setIsExpanded((prev) => !prev);
    }
  }, [isBatched]);

  const statusColor = getStatusColor(transaction.status, isStuck);
  const borderColor = getStatusBorderColor(transaction.status, isStuck);

  return (
    <div className={`border-l-2 ${borderColor} ${isStuck ? "animate-pulse" : ""}`}>
      {/* Main transaction row */}
      <div
        onClick={isBatched ? handleToggleExpand : handleExplorerClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                    bg-dark-brown/40 hover:bg-gold/10
                    transition-all duration-200 cursor-pointer
                    group`}
        title={isBatched ? "Click to expand batch details" : `View on ${getExplorerName()}: ${transaction.hash}`}
      >
        {/* Icon or Batch indicator */}
        <span className="text-base flex-shrink-0" role="img" aria-hidden="true">
          {isBatched ? "📦" : getTxIcon(transaction.type)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Description */}
          <div className="flex items-center gap-2">
            {isBatched ? (
              <>
                <span className="text-sm text-gold font-medium">{batchTotalCount} TXs Batched</span>
                <span className="text-xs text-gold/60 truncate">
                  {formatBatchSummary(transaction.batchDetails!, 2)}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-gold truncate">{transaction.description}</span>
                {transaction.transactionCount && transaction.transactionCount > 1 && (
                  <span className="text-xs text-gold/60 flex-shrink-0">({transaction.transactionCount} txs)</span>
                )}
              </>
            )}
          </div>

          {/* Hash and error */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gold/50 group-hover:text-gold/70 transition-colors">
              {truncateHash(transaction.hash)}
            </span>
            {transaction.status === "reverted" && transaction.errorMessage && (
              <span className="text-xs text-danger truncate max-w-[120px]" title={transaction.errorMessage}>
                {transaction.errorMessage}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator and time */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Status */}
          <div className={`flex items-center gap-1.5 ${statusColor}`}>
            {transaction.status === "pending" && (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-xs">{isStuck ? "Stuck" : "Pending"}</span>
              </>
            )}
            {transaction.status === "success" && (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs">Success</span>
              </>
            )}
            {transaction.status === "reverted" && (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-xs">Failed</span>
              </>
            )}
          </div>

          {/* Time */}
          <span className="text-[10px] text-gold/40">{timeAgo}</span>
        </div>

        {/* Expand/External link indicator */}
        {isBatched ? (
          <svg
            className={`w-3.5 h-3.5 text-gold/30 group-hover:text-gold/60 transition-all flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5 text-gold/30 group-hover:text-gold/60 transition-colors flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
      </div>

      {/* Expanded batch details */}
      {isBatched && isExpanded && (
        <div className="bg-dark-brown/20 border-t border-gold/10">
          {transaction.batchDetails!.map((detail, index) => (
            <div key={`${detail.type}-${index}`} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-xs">
              <span className="text-gold/40">├─</span>
              <span role="img" aria-hidden="true">
                {getTxIcon(detail.type)}
              </span>
              <span className="text-gold/70">{getTxShortLabel(detail.type)}</span>
              {detail.count > 1 && <span className="text-gold/50">×{detail.count}</span>}
            </div>
          ))}
          {/* Explorer link at bottom of expanded section */}
          <button
            onClick={handleExplorerClick}
            className="w-full flex items-center gap-2 px-3 py-1.5 pl-8 text-xs text-gold/50 hover:text-gold/80 hover:bg-gold/5 transition-colors"
          >
            <span className="text-gold/40">└─</span>
            <span>View on {getExplorerName()}</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
