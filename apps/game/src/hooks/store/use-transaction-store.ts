import { classifyTransactionError } from "@bibliothecadao/provider/errors";
import type { TransactionFailedPayload, TransactionType } from "@bibliothecadao/provider";
import { create } from "zustand";

/**
 * One line per state: sending (pending), checking (the node has not settled it yet; it keeps reconciling), done
 * (success), refused by the game with its reason (reverted), not sent, claimed only on proof (not_sent), or no
 * answer: neither Herald nor the node answered in the client's window, so the client stopped waiting and says so.
 */
export type TransactionStatus = "pending" | "checking" | "success" | "reverted" | "not_sent" | "no_answer";

/**
 * A sent action's row after a failure: refused only when the shard or the game said so (the revert stage carries a
 * REVERTED or REJECTED outcome, Herald's applied-nothing included), not sent only on proof, no answer when the client
 * itself gave up waiting for one (its own error says the action may still apply), and checking for anything else: a
 * failure to learn the outcome is not an outcome.
 */
export const statusAfterFailure = ({
  stage,
  failureKind,
  error,
}: Pick<TransactionFailedPayload, "stage" | "failureKind" | "error">): TransactionStatus => {
  if (failureKind === "not_sent") return "not_sent";
  if (stage === "revert") return "reverted";
  return classifyTransactionError(error).kind === "no_answer" ? "no_answer" : "checking";
};

/**
 * Still in the air: sending, or checking an outcome the node has not settled. An unanswered action is not: the client
 * stopped waiting for it, and the player may act again.
 */
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
}

const MAX_TRANSACTIONS = 50;

interface TransactionStoreState {
  transactions: Transaction[];
  isMinimized: boolean;

  // Actions
  addTransaction: (tx: Omit<Transaction, "submittedAt">) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  removeTransaction: (hash: string) => void;
  clearAllTransactions: () => void;
  setMinimized: (minimized: boolean) => void;
  toggleMinimized: () => void;
}

export const selectHasPendingTransactions = (state: Pick<TransactionStoreState, "transactions">): boolean =>
  state.transactions.some(isTransactionInFlight);

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  isMinimized: true,

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
}));
