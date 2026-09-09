import { create } from "zustand";
import type { ImportantFeedFilter } from "./important-feed-rows";
export const useEventsPanelStore = create<{
  tab: "events" | "chat";
  filter: ImportantFeedFilter | "log";
  focusRequest: number;
  openChat: () => void;
  openEvents: (filter?: ImportantFeedFilter | "log") => void;
}>()((set) => ({
  tab: "events",
  filter: "all",
  focusRequest: 0,
  openChat: () => set((state) => ({ tab: "chat", focusRequest: state.focusRequest + 1 })),
  openEvents: (filter) => set((state) => ({ tab: "events", filter: filter ?? state.filter })),
}));
