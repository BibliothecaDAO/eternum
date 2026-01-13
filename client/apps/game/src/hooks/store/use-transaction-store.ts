import { TransactionType } from "@bibliothecadao/provider";
import { create } from "zustand";

export type TransactionStatus = "pending" | "success" | "reverted";

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
  clearCompletedTransactions: () => void;
  setMinimized: (minimized: boolean) => void;
  toggleMinimized: () => void;
  setStuckThreshold: (ms: number) => void;

  // Computed getters
  getPendingTransactions: () => Transaction[];
  getSuccessTransactions: () => Transaction[];
  getRevertedTransactions: () => Transaction[];
  getStuckTransactions: () => Transaction[];
  getOverallStatus: () => "idle" | "pending" | "stuck" | "error";
}

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
        const pending = updatedTransactions.filter((t) => t.status === "pending");
        const completed = updatedTransactions
          .filter((t) => t.status !== "pending")
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

  clearCompletedTransactions: () =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.status === "pending"),
    })),

  setMinimized: (minimized) => set({ isMinimized: minimized }),

  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),

  setStuckThreshold: (ms) => set({ stuckThresholdMs: ms }),

  getPendingTransactions: () => {
    const { transactions, stuckThresholdMs } = get();
    const now = Date.now();
    return transactions.filter(
      (t) => t.status === "pending" && now - t.submittedAt < stuckThresholdMs,
    );
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
    return transactions.filter(
      (t) => t.status === "pending" && now - t.submittedAt >= stuckThresholdMs,
    );
  },

  getOverallStatus: () => {
    const { transactions, stuckThresholdMs } = get();
    const now = Date.now();

    const hasReverted = transactions.some(
      (t) => t.status === "reverted" && t.confirmedAt && now - t.confirmedAt < 60_000,
    );
    if (hasReverted) return "error";

    const hasStuck = transactions.some(
      (t) => t.status === "pending" && now - t.submittedAt >= stuckThresholdMs,
    );
    if (hasStuck) return "stuck";

    const hasPending = transactions.some((t) => t.status === "pending");
    if (hasPending) return "pending";

    return "idle";
  },
}));

// Debug utilities for mocking transactions in development
const generateMockHash = (): string => {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
};

const MOCK_TX_TYPES = [
  TransactionType.EXPLORE,
  TransactionType.ARMY_CREATE,
  TransactionType.BATTLE_START,
  TransactionType.BUY,
  TransactionType.SELL,
  TransactionType.CREATE_ORDER,
  TransactionType.TRAVEL_HEX,
  TransactionType.UPGRADE_LEVEL,
];

const getRandomTxType = (): TransactionType => {
  return MOCK_TX_TYPES[Math.floor(Math.random() * MOCK_TX_TYPES.length)];
};

const getTxDescription = (type: TransactionType): string => {
  const descriptions: Record<string, string> = {
    [TransactionType.EXPLORE]: "Exploring new lands",
    [TransactionType.ARMY_CREATE]: "Raising a new army",
    [TransactionType.BATTLE_START]: "Starting battle",
    [TransactionType.BUY]: "Purchasing from market",
    [TransactionType.SELL]: "Selling on market",
    [TransactionType.CREATE_ORDER]: "Creating trade order",
    [TransactionType.TRAVEL_HEX]: "Traveling to destination",
    [TransactionType.UPGRADE_LEVEL]: "Upgrading building",
  };
  return descriptions[type] ?? "Transaction in progress";
};

export interface TransactionDebugUtils {
  addMockPending: (type?: TransactionType) => string;
  addMockSuccess: (type?: TransactionType) => string;
  addMockReverted: (type?: TransactionType, errorMessage?: string) => string;
  addMockStuck: (type?: TransactionType) => string;
  completeTransaction: (hash: string) => void;
  revertTransaction: (hash: string, errorMessage?: string) => void;
  clearAll: () => void;
  expand: () => void;
  collapse: () => void;
  setStuckThreshold: (ms: number) => void;
  listTransactions: () => Transaction[];
  simulateScenario: (scenario: "happy" | "stuck" | "error" | "mixed") => void;
}

if (typeof window !== "undefined") {
  const debugKey = "__eternumTransactionDebug";
  const target = window as typeof window & { [k: string]: unknown };

  if (!target[debugKey]) {
    const debug: TransactionDebugUtils = {
      addMockPending: (type?: TransactionType) => {
        const hash = generateMockHash();
        const txType = type ?? getRandomTxType();
        useTransactionStore.getState().addTransaction({
          hash,
          type: txType,
          status: "pending",
          description: getTxDescription(txType),
        });
        return hash;
      },

      addMockSuccess: (type?: TransactionType) => {
        const hash = generateMockHash();
        const txType = type ?? getRandomTxType();
        useTransactionStore.getState().addTransaction({
          hash,
          type: txType,
          status: "success",
          description: getTxDescription(txType),
          confirmedAt: Date.now(),
        });
        return hash;
      },

      addMockReverted: (type?: TransactionType, errorMessage?: string) => {
        const hash = generateMockHash();
        const txType = type ?? getRandomTxType();
        useTransactionStore.getState().addTransaction({
          hash,
          type: txType,
          status: "reverted",
          description: getTxDescription(txType),
          confirmedAt: Date.now(),
          errorMessage: errorMessage ?? "Transaction reverted: execution failed",
        });
        return hash;
      },

      addMockStuck: (type?: TransactionType) => {
        const hash = generateMockHash();
        const txType = type ?? getRandomTxType();
        const stuckThreshold = useTransactionStore.getState().stuckThresholdMs;
        // Create a transaction that appears to have been submitted in the past
        const store = useTransactionStore.getState();
        store.addTransaction({
          hash,
          type: txType,
          status: "pending",
          description: getTxDescription(txType),
        });
        // Manually update the submittedAt to make it stuck
        useTransactionStore.setState((state) => ({
          transactions: state.transactions.map((t) =>
            t.hash === hash ? { ...t, submittedAt: Date.now() - stuckThreshold - 5000 } : t,
          ),
        }));
        return hash;
      },

      completeTransaction: (hash: string) => {
        useTransactionStore.getState().updateTransaction(hash, {
          status: "success",
          confirmedAt: Date.now(),
        });
      },

      revertTransaction: (hash: string, errorMessage?: string) => {
        useTransactionStore.getState().updateTransaction(hash, {
          status: "reverted",
          confirmedAt: Date.now(),
          errorMessage: errorMessage ?? "Transaction reverted",
        });
      },

      clearAll: () => {
        useTransactionStore.getState().clearAllTransactions();
      },

      expand: () => {
        useTransactionStore.getState().setMinimized(false);
      },

      collapse: () => {
        useTransactionStore.getState().setMinimized(true);
      },

      setStuckThreshold: (ms: number) => {
        useTransactionStore.getState().setStuckThreshold(ms);
      },

      listTransactions: () => {
        return useTransactionStore.getState().transactions;
      },

      simulateScenario: (scenario: "happy" | "stuck" | "error" | "mixed") => {
        debug.clearAll();
        debug.expand();

        switch (scenario) {
          case "happy":
            debug.addMockPending();
            debug.addMockSuccess();
            debug.addMockSuccess();
            break;
          case "stuck":
            debug.addMockStuck();
            debug.addMockPending();
            break;
          case "error":
            debug.addMockReverted(undefined, "Insufficient resources");
            debug.addMockPending();
            break;
          case "mixed":
            debug.addMockStuck();
            debug.addMockReverted(undefined, "Battle lost");
            debug.addMockPending();
            debug.addMockSuccess();
            debug.addMockSuccess();
            break;
        }
      },
    };

    target[debugKey] = debug;

    // Log usage instructions
    console.log(
      "%c[TransactionDebug] Debug utilities available at window.__eternumTransactionDebug",
      "color: #dfaa54; font-weight: bold",
    );
    console.log(
      "%cUsage examples:\n" +
        "  __eternumTransactionDebug.addMockPending() - Add a pending transaction\n" +
        "  __eternumTransactionDebug.addMockStuck() - Add a stuck transaction\n" +
        "  __eternumTransactionDebug.addMockReverted() - Add a failed transaction\n" +
        "  __eternumTransactionDebug.simulateScenario('mixed') - Simulate mixed scenario\n" +
        "  __eternumTransactionDebug.expand() - Expand the panel\n" +
        "  __eternumTransactionDebug.clearAll() - Clear all transactions",
      "color: #888",
    );
  }
}
