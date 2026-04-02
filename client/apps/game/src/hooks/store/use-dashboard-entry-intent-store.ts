import type { Chain } from "@contracts";
import { create } from "zustand";

export type DashboardEntryIntentAction = "register" | "play" | "settle" | "spectate" | "forge";

export interface DashboardEntryIntentWorld {
  name: string;
  chain: Chain;
  worldAddress?: string;
  worldKey: string;
}

export interface DashboardEntryIntent {
  id: string;
  action: DashboardEntryIntentAction;
  world: DashboardEntryIntentWorld;
  requestedAt: number;
  eternumEntryIntent?: "play" | "settle";
  numHyperstructuresLeft?: number;
}

interface DashboardEntryIntentStoreState {
  intent: DashboardEntryIntent | null;
  queueIntent: (intent: DashboardEntryIntent) => void;
  consumeIntent: (id: string) => DashboardEntryIntent | null;
  peekIntent: () => DashboardEntryIntent | null;
  clearIntent: () => void;
}

export const useDashboardEntryIntentStore = create<DashboardEntryIntentStoreState>((set, get) => ({
  intent: null,
  queueIntent: (intent) => set({ intent }),
  consumeIntent: (id) => {
    const intent = get().intent;
    if (!intent || intent.id !== id) {
      return null;
    }

    set({ intent: null });
    return intent;
  },
  peekIntent: () => get().intent,
  clearIntent: () => set({ intent: null }),
}));
