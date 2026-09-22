import { TransactionType } from "@bibliothecadao/provider";

import { useTransactionStore, type Transaction } from "./use-transaction-store";

/**
 * Mock transactions for the transaction center, on `window.__eternumTransactionDebug` in development. It lives
 * beside the store, not in it, so the store (which the app shell reads for pending work) carries no provider code.
 */
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
  TransactionType.EXPLORER_CREATE,
  TransactionType.ATTACK_EXPLORER_VS_EXPLORER,
  TransactionType.BUY,
  TransactionType.SELL,
  TransactionType.CREATE_ORDER,
  TransactionType.TRAVEL_HEX,
  TransactionType.LEVEL_UP,
];

const getRandomTxType = (): TransactionType => {
  return MOCK_TX_TYPES[Math.floor(Math.random() * MOCK_TX_TYPES.length)];
};

const getTxDescription = (type: TransactionType): string => {
  const descriptions: Record<string, string> = {
    [TransactionType.EXPLORE]: "Exploring new lands",
    [TransactionType.EXPLORER_CREATE]: "Raising a new army",
    [TransactionType.ATTACK_EXPLORER_VS_EXPLORER]: "Starting battle",
    [TransactionType.BUY]: "Purchasing from market",
    [TransactionType.SELL]: "Selling on market",
    [TransactionType.CREATE_ORDER]: "Creating trade order",
    [TransactionType.TRAVEL_HEX]: "Traveling to destination",
    [TransactionType.LEVEL_UP]: "Upgrading building",
    [TransactionType.ATTACK_EXPLORER_VS_GUARD]: "Claiming and garrisoning structure",
  };
  return descriptions[type] ?? "Transaction in progress";
};

interface TransactionDebugUtils {
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

if (typeof window !== "undefined" && import.meta.env.DEV) {
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
