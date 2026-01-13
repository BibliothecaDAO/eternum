import { useRef, useEffect, useCallback } from "react";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { StatusBeacon } from "./status-beacon";
import { TransactionList } from "./transaction-list";

interface TransactionCenterProps {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  className?: string;
}

export const TransactionCenter = ({
  position = "bottom-right",
  className = "",
}: TransactionCenterProps) => {
  const isMinimized = useTransactionStore((state) => state.isMinimized);
  const toggleMinimized = useTransactionStore((state) => state.toggleMinimized);
  const setMinimized = useTransactionStore((state) => state.setMinimized);
  const transactions = useTransactionStore((state) => state.transactions);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setMinimized(true);
      }
    };

    if (!isMinimized) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMinimized, setMinimized]);

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isMinimized) {
        setMinimized(true);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMinimized, setMinimized]);

  const handleClose = useCallback(() => {
    setMinimized(true);
  }, [setMinimized]);

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 ${positionClasses[position]} ${className}`}
    >
      {isMinimized ? (
        <StatusBeacon onClick={toggleMinimized} />
      ) : (
        <div
          className="w-80 bg-dark-brown/95 rounded-lg border border-gold/30 shadow-2xl
                     shadow-black/50 overflow-hidden backdrop-blur-sm
                     transition-all duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gold/20 bg-dark-brown/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gold">Transactions</span>
              {transactions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/20 text-gold/70">
                  {transactions.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Minimize button */}
              <button
                onClick={toggleMinimized}
                className="p-1.5 rounded hover:bg-gold/10 text-gold/50 hover:text-gold transition-colors"
                aria-label="Minimize"
                title="Minimize"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={handleClose}
                className="p-1.5 rounded hover:bg-gold/10 text-gold/50 hover:text-gold transition-colors"
                aria-label="Close"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Transaction list */}
          <TransactionList />

          {/* Footer with helpful info */}
          <div className="px-3 py-2 border-t border-gold/10 bg-dark-brown/30">
            <p className="text-[10px] text-gold/30 text-center">
              Click a transaction to view on Voyager
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
