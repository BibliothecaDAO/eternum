import { ResourcesIds } from "@bibliothecadao/types";
import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const resolveCurrentGameId = (): string => {
  try {
    const season = configManager.getSeasonConfig();
    return `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
  } catch {
    return "unknown";
  }
};

export interface TransferAutomationResourceConfig {
  resourceId: ResourcesIds;
  amount: number;
}

export interface TransferAutomationEntry {
  id: string;
  active: boolean;
  createdAt: number;
  gameId: string;
  sourceEntityId: string;
  sourceName?: string;
  destinationEntityId: string;
  destinationName?: string;
  resourceIds: ResourcesIds[];
  resourceConfigs?: TransferAutomationResourceConfig[];
  intervalMinutes: number; // 5..60 (used when active)
  lastRunAt?: number;
  nextRunAt?: number | null;
}

type NewEntry = Omit<TransferAutomationEntry, "id" | "createdAt" | "lastRunAt" | "nextRunAt" | "active" | "gameId"> & {
  active?: boolean;
  gameId?: string;
};

interface TransferAutomationState {
  entries: Record<string, TransferAutomationEntry>;
  add: (entry: NewEntry) => string;
  update: (id: string, patch: Partial<TransferAutomationEntry>) => void;
  remove: (id: string) => void;
  toggleActive: (id: string, active?: boolean) => void;
  scheduleNext: (id: string, base?: number) => void;
  clearAll: () => void;
  pruneForGame: (gameId: string) => void;
}

const clampInterval = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return 5;
  return Math.min(60, Math.max(5, Math.round(minutes)));
};

const getBlockNowMs = (): number => {
  const { currentBlockTimestamp } = getBlockTimestamp();
  return currentBlockTimestamp * 1000;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
    } catch {
      // ignore and fall through to timestamp-based id
    }
  }
  return `ta_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
};

const sanitizeResourceConfigs = (raw: unknown, fallbackAmount?: number): TransferAutomationEntry["resourceConfigs"] => {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const fallback = Number.isFinite(fallbackAmount) ? Math.max(0, Math.floor(fallbackAmount as number)) : 0;
  const sanitized: TransferAutomationResourceConfig[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as { resourceId?: unknown; amount?: unknown; flatAmount?: unknown };
    if (typeof candidate.resourceId !== "number") return;
    let amountSource: unknown = candidate.amount;
    if (typeof amountSource !== "number") {
      amountSource = candidate.flatAmount;
    }
    const normalizedAmount = Number.isFinite(amountSource as number) ? (amountSource as number) : fallback;
    sanitized.push({
      resourceId: candidate.resourceId,
      amount: Math.max(0, Math.floor(normalizedAmount)),
    });
  });
  return sanitized.length > 0 ? sanitized : undefined;
};

const buildConfigsFromResources = (
  resourceIds: ResourcesIds[],
  fallbackAmount?: number,
): TransferAutomationEntry["resourceConfigs"] => {
  const fallback = Number.isFinite(fallbackAmount) ? Math.max(0, Math.floor(fallbackAmount as number)) : 0;
  if (resourceIds.length === 0) return undefined;
  return resourceIds.map((rid) => ({
    resourceId: rid,
    amount: fallback,
  }));
};

export const useTransferAutomationStore = create<TransferAutomationState>()(
  persist(
    (set) => ({
      entries: {},
      add: (raw) => {
        const id = generateId();
        const now = getBlockNowMs();
        const active = raw.active ?? true;
        const gameId = raw.gameId ?? resolveCurrentGameId();
        const resourceIdsArray = Array.from(new Set(raw.resourceIds || [])).filter(
          (r) => typeof r === "number",
        ) as ResourcesIds[];
        const entry: TransferAutomationEntry = {
          id,
          createdAt: now,
          active,
          gameId,
          sourceEntityId: String(raw.sourceEntityId),
          sourceName: raw.sourceName,
          destinationEntityId: String(raw.destinationEntityId),
          destinationName: raw.destinationName,
          resourceIds: resourceIdsArray,
          resourceConfigs:
            sanitizeResourceConfigs(raw.resourceConfigs) ?? buildConfigsFromResources(resourceIdsArray, undefined),
          intervalMinutes: clampInterval(raw.intervalMinutes),
          lastRunAt: undefined,
          nextRunAt: active ? now + clampInterval(raw.intervalMinutes) * 60_000 : null,
        };
        set((state) => ({ entries: { ...state.entries, [id]: entry } }));
        return id;
      },
      update: (id, patch) => {
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const next: TransferAutomationEntry = {
            ...prev,
            ...patch,
            intervalMinutes:
              patch.intervalMinutes !== undefined ? clampInterval(patch.intervalMinutes) : prev.intervalMinutes,
            resourceConfigs:
              patch.resourceConfigs !== undefined
                ? sanitizeResourceConfigs(patch.resourceConfigs)
                : prev.resourceConfigs,
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
      toggleActive: (id, active) =>
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const isActive = active ?? !prev.active;
          const now = getBlockNowMs();
          const next: TransferAutomationEntry = {
            ...prev,
            active: isActive,
            nextRunAt: isActive ? now + clampInterval(prev.intervalMinutes) * 60_000 : null,
          };
          return { entries: { ...state.entries, [id]: next } };
        }),
      scheduleNext: (id, base) =>
        set((state) => {
          const prev = state.entries[id];
          if (!prev) return state;
          const now = base ?? getBlockNowMs();
          const next: TransferAutomationEntry = {
            ...prev,
            nextRunAt: now + clampInterval(prev.intervalMinutes) * 60_000,
          };
          return { entries: { ...state.entries, [id]: next } };
        }),
      clearAll: () => set({ entries: {} }),
      pruneForGame: (gameId) =>
        set((state) => {
          const entries = Object.fromEntries(
            Object.entries(state.entries).filter(([, entry]) => entry.gameId === gameId),
          );
          return { entries };
        }),
    }),
    {
      name: "eternum-transfer-automation",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
      migrate: (persisted: unknown) => {
        if (!persisted || typeof persisted !== "object") return { entries: {} };
        const rawEntries = (persisted as { entries?: unknown }).entries;
        if (!rawEntries || typeof rawEntries !== "object") return { entries: {} };
        const entries: Record<string, TransferAutomationEntry> = {};
        Object.entries(rawEntries as Record<string, unknown>).forEach(([id, value]) => {
          if (!value || typeof value !== "object") return;
          const persistedEntry = value as Record<string, unknown>;
          const resourceIdsRaw = Array.isArray(persistedEntry.resourceIds) ? persistedEntry.resourceIds : [];
          const resourceIds = resourceIdsRaw.filter((r): r is ResourcesIds => typeof r === "number");
          const intervalMinutes = clampInterval(
            typeof persistedEntry.intervalMinutes === "number" ? persistedEntry.intervalMinutes : 5,
          );
          const fallbackAmount =
            typeof persistedEntry.flatAmount === "number"
              ? Math.max(0, Math.floor(persistedEntry.flatAmount))
              : undefined;
          const resourceConfigs =
            sanitizeResourceConfigs(persistedEntry.resourceConfigs, fallbackAmount) ??
            buildConfigsFromResources(resourceIds, fallbackAmount);
          entries[id] = {
            id,
            createdAt: typeof persistedEntry.createdAt === "number" ? persistedEntry.createdAt : Date.now(),
            active: Boolean(persistedEntry.active),
            gameId: typeof persistedEntry.gameId === "string" ? persistedEntry.gameId : resolveCurrentGameId(),
            sourceEntityId: String(persistedEntry.sourceEntityId ?? "0"),
            sourceName: typeof persistedEntry.sourceName === "string" ? persistedEntry.sourceName : undefined,
            destinationEntityId: String(persistedEntry.destinationEntityId ?? "0"),
            destinationName:
              typeof persistedEntry.destinationName === "string" ? persistedEntry.destinationName : undefined,
            resourceIds,
            resourceConfigs,
            intervalMinutes,
            lastRunAt: typeof persistedEntry.lastRunAt === "number" ? persistedEntry.lastRunAt : undefined,
            nextRunAt:
              persistedEntry.nextRunAt === null || typeof persistedEntry.nextRunAt === "number"
                ? (persistedEntry.nextRunAt as number | null)
                : null,
          };
        });
        return { entries };
      },
    },
  ),
);
