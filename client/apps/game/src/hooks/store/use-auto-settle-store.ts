import type { Chain } from "@contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AutoSettleStatus = "idle" | "armed" | "opening" | "settling" | "failed" | "completed";

export interface AutoSettleEntryRecord {
  enabled: boolean;
  walletAddress: string;
  chain: Chain;
  worldName: string;
  worldKey: string;
  triggerAtSec: number;
  armedAtMs: number;
  status: AutoSettleStatus;
  lastError: string | null;
  lastAttemptAtMs: number | null;
}

interface AutoSettleStoreState {
  entries: Record<string, AutoSettleEntryRecord>;
  getEntry: (key: string) => AutoSettleEntryRecord | undefined;
  upsertEntry: (key: string, entry: AutoSettleEntryRecord) => void;
  setEnabled: (key: string, enabled: boolean) => void;
  markOpening: (key: string, attemptedAtMs: number) => void;
  markSettling: (key: string, attemptedAtMs: number) => void;
  markFailed: (key: string, error: string) => void;
  markCompleted: (key: string) => void;
  clearEntry: (key: string) => void;
}

export const AUTO_SETTLE_STORAGE_KEY = "eternum-auto-settle";

const createLocalStorage = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  const storage = new Map<string, string>();
  return {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => {
      storage.set(name, value);
    },
    removeItem: (name: string) => {
      storage.delete(name);
    },
  };
};

export const createAutoSettleEntryKey = ({
  chain,
  worldName,
  walletAddress,
}: {
  chain: Chain;
  worldName: string;
  walletAddress: string;
}) => `${chain}:${worldName}:${walletAddress.toLowerCase()}`;

const updateEntry = (
  entries: Record<string, AutoSettleEntryRecord>,
  key: string,
  updater: (entry: AutoSettleEntryRecord) => AutoSettleEntryRecord,
) => {
  const current = entries[key];
  if (!current) return entries;

  return {
    ...entries,
    [key]: updater(current),
  };
};

const migrateAutoSettleEntries = (persistedState: unknown): Record<string, AutoSettleEntryRecord> => {
  if (
    typeof persistedState !== "object" ||
    persistedState === null ||
    !("entries" in persistedState) ||
    typeof (persistedState as { entries?: unknown }).entries !== "object" ||
    (persistedState as { entries?: unknown }).entries === null
  ) {
    return {};
  }

  const entries = (persistedState as { entries: Record<string, unknown> }).entries;

  return Object.fromEntries(
    Object.entries(entries).flatMap(([key, entry]) => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const currentEntry = entry as AutoSettleEntryRecord & { settleAtSec?: unknown };
      const triggerAtSec =
        typeof currentEntry.triggerAtSec === "number"
          ? currentEntry.triggerAtSec
          : typeof currentEntry.settleAtSec === "number"
            ? currentEntry.settleAtSec
            : null;

      if (triggerAtSec == null) {
        return [];
      }

      return [
        [
          key,
          {
            enabled: currentEntry.enabled,
            walletAddress: currentEntry.walletAddress,
            chain: currentEntry.chain,
            worldName: currentEntry.worldName,
            worldKey: currentEntry.worldKey,
            triggerAtSec,
            armedAtMs: currentEntry.armedAtMs,
            status: currentEntry.status,
            lastError: currentEntry.lastError,
            lastAttemptAtMs: currentEntry.lastAttemptAtMs,
          } satisfies AutoSettleEntryRecord,
        ],
      ];
    }),
  );
};

export const useAutoSettleStore = create<AutoSettleStoreState>()(
  persist(
    (set, get) => ({
      entries: {},
      getEntry: (key) => get().entries[key],
      upsertEntry: (key, entry) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: entry,
          },
        })),
      setEnabled: (key, enabled) =>
        set((state) => ({
          entries: updateEntry(state.entries, key, (entry) => ({
            ...entry,
            enabled,
            status: enabled ? "armed" : "idle",
            lastError: enabled ? null : entry.lastError,
          })),
        })),
      markOpening: (key, attemptedAtMs) =>
        set((state) => ({
          entries: updateEntry(state.entries, key, (entry) => ({
            ...entry,
            enabled: true,
            status: "opening",
            lastAttemptAtMs: attemptedAtMs,
            lastError: null,
          })),
        })),
      markSettling: (key, attemptedAtMs) =>
        set((state) => ({
          entries: updateEntry(state.entries, key, (entry) => ({
            ...entry,
            enabled: true,
            status: "settling",
            lastAttemptAtMs: attemptedAtMs,
            lastError: null,
          })),
        })),
      markFailed: (key, error) =>
        set((state) => ({
          entries: updateEntry(state.entries, key, (entry) => ({
            ...entry,
            enabled: true,
            status: "failed",
            lastError: error,
          })),
        })),
      markCompleted: (key) =>
        set((state) => ({
          entries: updateEntry(state.entries, key, (entry) => ({
            ...entry,
            enabled: false,
            status: "completed",
            lastError: null,
          })),
        })),
      clearEntry: (key) =>
        set((state) => {
          const entries = { ...state.entries };
          delete entries[key];
          return { entries };
        }),
    }),
    {
      name: AUTO_SETTLE_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(createLocalStorage),
      partialize: (state) => ({ entries: state.entries }),
      migrate: (persistedState) => ({
        entries: migrateAutoSettleEntries(persistedState),
      }),
    },
  ),
);
