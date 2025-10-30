import { ResourcesIds } from "@bibliothecadao/types";
import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const resolveCurrentGameId = (): string => {
  try {
    const season = configManager.getSeasonConfig();
    return `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
  } catch (_error) {
    return "unknown";
  }
};

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
  resourceConfigs?: Array<{
    resourceId: ResourcesIds;
    mode: "percent" | "flat";
    percent?: number; // 5..90 when mode = percent
    flatPercent?: number; // 1..90 when mode = flat (percent of current balance at execution time)
  }>;
  amountMode?: "percent" | "flat"; // default percent for v1
  percent: number; // 5..90 when amountMode = percent
  flatAmount?: number; // human units per resource when amountMode = flat
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

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 5;
  return Math.min(90, Math.max(5, Math.round(value)));
};

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
      return (crypto as any).randomUUID();
    } catch (_) {}
  }
  return `ta_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
};

export const useTransferAutomationStore = create<TransferAutomationState>()(
  persist(
    (set, get) => ({
      entries: {},
      add: (raw) => {
        const id = generateId();
        const now = getBlockNowMs();
        const active = raw.active ?? true;
        const gameId = raw.gameId ?? resolveCurrentGameId();
        const entry: TransferAutomationEntry = {
          id,
          createdAt: now,
          active,
          gameId,
          sourceEntityId: String(raw.sourceEntityId),
          sourceName: raw.sourceName,
          destinationEntityId: String(raw.destinationEntityId),
          destinationName: raw.destinationName,
          resourceIds: Array.from(new Set(raw.resourceIds || [])).filter(
            (r) => typeof r === "number",
          ) as ResourcesIds[],
          amountMode: raw.amountMode ?? "percent",
          percent: clampPercent(raw.percent),
          flatAmount: typeof raw.flatAmount === "number" ? Math.max(0, Math.floor(raw.flatAmount)) : undefined,
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
            amountMode: patch.amountMode ?? prev.amountMode ?? "percent",
            percent: patch.percent !== undefined ? clampPercent(patch.percent) : prev.percent,
            flatAmount:
              patch.flatAmount !== undefined ? Math.max(0, Math.floor(patch.flatAmount as number)) : prev.flatAmount,
            intervalMinutes:
              patch.intervalMinutes !== undefined ? clampInterval(patch.intervalMinutes) : prev.intervalMinutes,
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
      migrate: (persisted: any, version) => {
        if (!persisted || typeof persisted !== "object") return { entries: {} };
        const rawEntries = (persisted as any).entries ?? {};
        const entries: Record<string, TransferAutomationEntry> = {};
        Object.entries(rawEntries).forEach(([id, value]) => {
          const v = value as TransferAutomationEntry;
          if (!v || typeof v !== "object") return;
          const resourceIds = Array.isArray(v.resourceIds)
            ? (v.resourceIds.filter((r) => typeof r === "number") as ResourcesIds[])
            : [];
          const percent = clampPercent((v as any).percent ?? 5);
          const intervalMinutes = clampInterval((v as any).intervalMinutes ?? 5);
          let resourceConfigs: TransferAutomationEntry["resourceConfigs"] | undefined;
          if (Array.isArray((v as any).resourceConfigs)) {
            resourceConfigs = ((v as any).resourceConfigs as any[])
              .map((c) => ({
                resourceId: c.resourceId,
                mode: c.mode === "flat" ? "flat" : "percent",
                percent: typeof c.percent === "number" ? clampPercent(c.percent) : undefined,
                flatPercent:
                  typeof c.flatPercent === "number" ? Math.min(90, Math.max(1, Math.floor(c.flatPercent))) : undefined,
                flatAmount: typeof c.flatAmount === "number" ? Math.max(0, Math.floor(c.flatAmount)) : undefined,
              }))
              .map((c) => ({
                resourceId: c.resourceId,
                mode: c.mode,
                percent: c.percent,
                flatPercent: (c as any).flatPercent,
                flatAmount: (c as any).flatAmount,
              })) as any;
          }
          entries[id] = {
            id,
            createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
            active: Boolean((v as any).active),
            gameId: typeof (v as any).gameId === "string" ? (v as any).gameId : resolveCurrentGameId(),
            sourceEntityId: String((v as any).sourceEntityId ?? "0"),
            sourceName: (v as any).sourceName,
            destinationEntityId: String((v as any).destinationEntityId ?? "0"),
            destinationName: (v as any).destinationName,
            resourceIds,
            resourceConfigs,
            amountMode: (v as any).amountMode ?? "percent",
            percent,
            flatAmount:
              typeof (v as any).flatAmount === "number" ? Math.max(0, Math.floor((v as any).flatAmount)) : undefined,
            intervalMinutes,
            lastRunAt: typeof (v as any).lastRunAt === "number" ? (v as any).lastRunAt : undefined,
            nextRunAt:
              (v as any).nextRunAt === null || typeof (v as any).nextRunAt === "number" ? (v as any).nextRunAt : null,
          };
        });
        return { entries };
      },
    },
  ),
);
