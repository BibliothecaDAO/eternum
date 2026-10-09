import type { BatchedTransactionDetail, TransactionFailedPayload, TransactionType } from "@bibliothecadao/provider";
import { create } from "zustand";

import {
  computeStaleTransactionTelemetry,
  type StaleTransactionTelemetry,
} from "./compute-stale-transaction-telemetry";

/**
 * One line per state: sending (pending), checking (the node has not settled it yet; it keeps reconciling), done
 * (success), refused by the game with its reason (reverted), or not sent, claimed only on proof (not_sent).
 */
export type TransactionStatus = "pending" | "checking" | "success" | "reverted" | "not_sent";

/**
 * A sent action's row after a failure: refused only when the shard or the game said so (the revert stage carries a
 * REVERTED or REJECTED outcome, Herald's applied-nothing included), not sent only on proof, and checking for anything
 * else: a failure to learn the outcome is not an outcome.
 */
export const statusAfterFailure = ({
  stage,
  failureKind,
}: Pick<TransactionFailedPayload, "stage" | "failureKind">): TransactionStatus =>
  failureKind === "not_sent" ? "not_sent" : stage === "revert" ? "reverted" : "checking";

/** Still in the air: sending, or checking an outcome the node has not settled. */
export const isTransactionInFlight = (transaction: Pick<Transaction, "status">): boolean =>
  transaction.status === "pending" || transaction.status === "checking";

export interface Transaction {
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  submittedAt: number;
  confirmedAt?: number;
  description: string;
  transactionCount?: number;
  errorMessage?: string;
  /** Details about batched transactions - shows breakdown by type */
  batchDetails?: BatchedTransactionDetail[];
}

const MAX_TRANSACTIONS = 50;
const DEFAULT_STUCK_THRESHOLD_MS = 30_000;

interface TransactionStoreState {
  transactions: Transaction[];
  isMinimized: boolean;
  stuckThresholdMs: number;

  // Actions
  addTransaction: (tx: Omit<Transaction, "submittedAt">) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  removeTransaction: (hash: string) => void;
  clearAllTransactions: () => void;
  setMinimized: (minimized: boolean) => void;
  toggleMinimized: () => void;
  setStuckThreshold: (ms: number) => void;

  // Computed getters
  getPendingTransactions: () => Transaction[];
  getSuccessTransactions: () => Transaction[];
  getRevertedTransactions: () => Transaction[];
  getStuckTransactions: () => Transaction[];
  getOverallStatus: () => "idle" | "pending" | "stuck" | "error";
  getStaleTransactionTelemetry: () => StaleTransactionTelemetry;
}

export const selectHasPendingTransactions = (state: Pick<TransactionStoreState, "transactions">): boolean =>
  state.transactions.some(isTransactionInFlight);

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  isMinimized: true,
  stuckThresholdMs: DEFAULT_STUCK_THRESHOLD_MS,

  addTransaction: (tx) =>
    set((state) => {
      // Check if transaction already exists
      const exists = state.transactions.some((t) => t.hash === tx.hash);
      if (exists) {
        return state;
      }

      const newTransaction: Transaction = {
        ...tx,
        submittedAt: Date.now(),
      };

      let updatedTransactions = [newTransaction, ...state.transactions];

      // Prune old completed transactions if over limit
      if (updatedTransactions.length > MAX_TRANSACTIONS) {
        const pending = updatedTransactions.filter(isTransactionInFlight);
        const completed = updatedTransactions
          .filter((t) => !isTransactionInFlight(t))
          .slice(0, MAX_TRANSACTIONS - pending.length);
        updatedTransactions = [...pending, ...completed];
      }

      return { transactions: updatedTransactions };
    }),

  updateTransaction: (hash, updates) =>
    set((state) => {
      const transactionIndex = state.transactions.findIndex((t) => t.hash === hash);
      if (transactionIndex === -1) {
        return state;
      }

      const updatedTransactions = [...state.transactions];
      updatedTransactions[transactionIndex] = {
        ...updatedTransactions[transactionIndex],
        ...updates,
      };

      return { transactions: updatedTransactions };
    }),

  removeTransaction: (hash) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.hash !== hash),
    })),

  clearAllTransactions: () => set({ transactions: [] }),

  setMinimized: (minimized) => set({ isMinimized: minimized }),

  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

  setStuckThreshold: (ms) => set({ stuckThresholdMs: ms }),

  getPendingTransactions: () => {
    const { transactions, stuckThresholdMs } = get();
    const now = Date.now();
    return transactions.filter((t) => t.status === "pending" && now - t.submittedAt < stuckThresholdMs);
  },

  getSuccessTransactions: () => {
    const { transactions } = get();
    return transactions.filter((t) => t.status === "success");
  },

  getRevertedTransactions: () => {
    const { transactions } = get();
    return transactions.filter((t) => t.status === "reverted");
  },

  getStuckTransactions: () => {
    const { transactions, stuckThresholdMs } = get();
    const now = Date.now();
    return transactions.filter((t) => t.status === "pending" && now - t.submittedAt >= stuckThresholdMs);
  },

  getOverallStatus: () => {
    const { transactions, stuckThresholdMs } = get();
    const now = Date.now();

    const hasReverted = transactions.some(
      (t) => t.status === "reverted" && t.confirmedAt && now - t.confirmedAt < 60_000,
    );
    if (hasReverted) return "error";

    const hasStuck = transactions.some((t) => t.status === "pending" && now - t.submittedAt >= stuckThresholdMs);
    if (hasStuck) return "stuck";

    const hasPending = transactions.some((t) => t.status === "pending");
    if (hasPending) return "pending";

    return "idle";
  },

  getStaleTransactionTelemetry: () => {
    const { transactions, stuckThresholdMs } = get();
    return computeStaleTransactionTelemetry(transactions, Date.now(), stuckThresholdMs);
  },
}));
