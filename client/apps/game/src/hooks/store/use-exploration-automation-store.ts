import { configManager } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ExplorationStrategyId } from "@/automation/exploration/types";

export const EXPLORATION_AUTOMATION_INTERVAL_MS = 30_000;
export const DEFAULT_SCOPE_RADIUS = 24;
export const DEFAULT_STRATEGY_ID: ExplorationStrategyId = "basic-frontier";

const resolveCurrentGameId = (): string => {
  try {
    const season = configManager.getSeasonConfig();
    return `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
  } catch {
    return "unknown";
  }
};

const getNowMs = (): number => Date.now();

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    } catch {
      // ignore and fall through
    }
  }
  return `ea_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
};

export interface ExplorationAutomationEntry {
  id: string;
  explorerId: string;
  active: boolean;
  createdAt: number;
  gameId: string;
  scopeRadius: number;
  strategyId: ExplorationStrategyId;
  lastRunAt?: number;
  nextRunAt?: number | null;
  lastAction?: string;
  blockedReason?: string | null;
  lastError?: string | null;
}

type NewEntry = Omit<ExplorationAutomationEntry, "id" | "createdAt" | "nextRunAt" | "gameId"> & {
  gameId?: string;
};

interface ExplorationAutomationState {
  entries: Record<string, ExplorationAutomationEntry>;
  add: (entry: NewEntry) => string;
  update: (id: string, patch: Partial<ExplorationAutomationEntry>) => void;
  toggleActive: (id: string, active?: boolean) => void;
  scheduleNext: (id: string, base?: number) => void;
  remove: (id: string) => void;
  pruneForGame: (gameId: string) => void;
}

const normalizeScopeRadius = (value: number | undefined): number => {
  const numeric = Number.isFinite(value) ? Math.round(value as number) : DEFAULT_SCOPE_RADIUS;
  return Math.max(1, numeric);
};

const normalizeTimestamp = (value: unknown, fallback: number | null = null): number | null => {
  if (value === null || value === undefined) return fallback;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const useExplorationAutomationStore = create<ExplorationAutomationState>()(
  persist(
    (set) => ({
      entries: {},
      add: (raw) => {
        const id = generateId();
        const now = getNowMs();
        const active = raw.active ?? true;
        const gameId = raw.gameId ?? resolveCurrentGameId();
        const scopeRadius = normalizeScopeRadius(raw.scopeRadius);
        const entry: ExplorationAutomationEntry = {
          id,
          explorerId: String(raw.explorerId),
          active,
          createdAt: now,
          gameId,
          scopeRadius,
          strategyId: raw.strategyId ?? DEFAULT_STRATEGY_ID,
          lastRunAt: raw.lastRunAt,
          lastAction: raw.lastAction,
          blockedReason: raw.blockedReason ?? null,
          lastError: raw.lastError ?? null,
          nextRunAt: active ? now + EXPLORATION_AUTOMATION_INTERVAL_MS : null,
        };
        set((state) => ({ entries: { ...state.entries, [id]: entry } }));
        return id;
      },
      update: (id, patch) => {
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const next: ExplorationAutomationEntry = {
            ...prev,
            ...patch,
            scopeRadius: normalizeScopeRadius(patch.scopeRadius ?? prev.scopeRadius),
            strategyId: (patch.strategyId ?? prev.strategyId) as ExplorationStrategyId,
            lastRunAt: normalizeTimestamp(patch.lastRunAt ?? prev.lastRunAt, prev.lastRunAt ?? null) ?? undefined,
            nextRunAt: normalizeTimestamp(patch.nextRunAt ?? prev.nextRunAt, prev.nextRunAt ?? null),
          };
          return { entries: { ...state.entries, [id]: next } };
        });
      },
      toggleActive: (id, active) => {
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const isActive = active ?? !prev.active;
          const now = getNowMs();
          const next: ExplorationAutomationEntry = {
            ...prev,
            active: isActive,
            nextRunAt: isActive ? now + EXPLORATION_AUTOMATION_INTERVAL_MS : null,
          };
          return { entries: { ...state.entries, [id]: next } };
        });
      },
      scheduleNext: (id, base) => {
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const now = base ?? getNowMs();
          const next: ExplorationAutomationEntry = {
            ...prev,
            nextRunAt: now + EXPLORATION_AUTOMATION_INTERVAL_MS,
          };
          return { entries: { ...state.entries, [id]: next } };
        });
      },
      remove: (id) =>
        set((state) => {
          const next = { ...state.entries };
          delete next[id];
          return { entries: next };
        }),
      pruneForGame: (gameId) =>
        set((state) => {
          const entries = Object.fromEntries(
            Object.entries(state.entries).filter(([, entry]) => entry.gameId === gameId),
          );
          return { entries };
        }),
    }),
    {
      name: "eternum-exploration-automation",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== "object") return { entries: {} };
        const rawEntries = (persisted as { entries?: unknown }).entries;
        if (!rawEntries || typeof rawEntries !== "object") return { entries: {} };
        const entries: Record<string, ExplorationAutomationEntry> = {};
        Object.entries(rawEntries as Record<string, unknown>).forEach(([id, value]) => {
          if (!value || typeof value !== "object") return;
          const entry = value as Partial<ExplorationAutomationEntry>;
          entries[id] = {
            id,
            explorerId: String(entry.explorerId ?? ""),
            active: Boolean(entry.active),
            createdAt: normalizeTimestamp(entry.createdAt, Date.now()) ?? Date.now(),
            gameId: typeof entry.gameId === "string" ? entry.gameId : resolveCurrentGameId(),
            scopeRadius: normalizeScopeRadius(entry.scopeRadius),
            strategyId: (entry.strategyId ?? DEFAULT_STRATEGY_ID) as ExplorationStrategyId,
            lastRunAt: normalizeTimestamp(entry.lastRunAt, null) ?? undefined,
            nextRunAt: normalizeTimestamp(entry.nextRunAt, null),
            lastAction: entry.lastAction,
            blockedReason: entry.blockedReason ?? null,
            lastError: entry.lastError ?? null,
          };
        });
        return { entries };
      },
    },
  ),
);
