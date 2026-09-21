import { Loader2, Check, X, ChevronDown, ExternalLink } from "@/ui/design-system/atoms/game-icons";
import { useState, useCallback } from "react";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
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
  const isPending = transaction.status === "pending";
  // A pending row re-renders on the clock so its elapsed label keeps moving; a settled one is static.
  useNowSeconds(isPending);
  const timeAgo = formatTimeAgo(
    isPending ? transaction.submittedAt : (transaction.confirmedAt ?? transaction.submittedAt),
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this is a batched transaction
  const isBatched = transaction.batchDetails && transaction.batchDetails.length > 0;
  const batchTotalCount = isBatched ? getBatchTotalCount(transaction.batchDetails!) : 0;
  const explorerUrl = getExplorerTxUrl(transaction.hash);

  const handleExplorerClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (explorerUrl) {
        window.open(explorerUrl, "_blank", "noopener,noreferrer");
      }
    },
    [explorerUrl],
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
        onClick={isBatched ? handleToggleExpand : explorerUrl ? handleExplorerClick : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left
                    bg-dark-brown/40 hover:bg-gold/10
                    transition-all duration-200 ${isBatched || explorerUrl ? "cursor-pointer" : ""}
                    group`}
        title={
          isBatched
            ? "Click to expand batch details"
            : explorerUrl
              ? `View on ${getExplorerName()}: ${transaction.hash}`
              : transaction.hash
        }
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
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">{isStuck ? "Stuck" : "Pending"}</span>
              </>
            )}
            {transaction.status === "success" && (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs">Success</span>
              </>
            )}
            {transaction.status === "reverted" && (
              <>
                <X className="w-3.5 h-3.5" />
                <span className="text-xs">Failed</span>
              </>
            )}
          </div>

          {/* Time */}
          <span className="text-[10px] text-gold/40">{timeAgo}</span>
        </div>

        {/* Expand/External link indicator */}
        {isBatched ? (
          <ChevronDown
            className={`w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-all flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          />
        ) : (
          <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
          {explorerUrl && (
            <button
              onClick={handleExplorerClick}
              className="w-full flex items-center gap-2 px-3 py-1.5 pl-8 text-xs text-gold/50 hover:text-gold/80 hover:bg-gold/5 transition-colors"
            >
              <span className="text-gold/40">└─</span>
              <span>View on {getExplorerName()}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
