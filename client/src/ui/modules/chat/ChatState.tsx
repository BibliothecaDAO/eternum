import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_TAB, EVENT_STREAM_TAB } from "./ChatTab";
import { CHAT_STORAGE_KEY, GLOBAL_CHANNEL_KEY } from "./constants";
import { Tab } from "./types";

interface ChatState {
  tabs: Tab[];
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  setTabs: (tabs: Tab[]) => void;
  addTab: (tab: Tab) => void;
  hideTab: (tab: Tab) => void;
  deleteTab: (address: string) => void;
  changeTabByAddress: (address: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      tabs: [DEFAULT_TAB, EVENT_STREAM_TAB],
      currentTab: DEFAULT_TAB,
      setCurrentTab: (tab: Tab) => {
        set({ currentTab: tab });
        // Update the lastSeen timestamp when a tab is set as current
        set((state) => ({
          tabs: state.tabs.map((t) => (t.address === tab.address ? { ...t, lastSeen: new Date() } : t)),
        }));
      },
      setTabs: (tabs: Tab[]) => set({ tabs }),
      addTab: (newTab: Tab, switchToTab: boolean = false) =>
        set((state) => {
          const existingTabIndex = state.tabs.findIndex((tab) => tab.address === newTab.address);
          if (existingTabIndex !== -1) {
            // Update existing tab
            const updatedTabs = [...state.tabs];
            updatedTabs[existingTabIndex] = {
              ...updatedTabs[existingTabIndex],
              ...newTab,
            };
            return {
              tabs: updatedTabs,
              // Only switch tabs if explicitly requested
              currentTab: switchToTab ? { ...newTab, lastSeen: new Date() } : state.currentTab,
            };
          } else {
            // Add new tab
            return {
              tabs: [...state.tabs, { ...newTab, lastSeen: new Date() }],
              // Only switch tabs if explicitly requested
              currentTab: switchToTab ? { ...newTab, lastSeen: new Date() } : state.currentTab,
            };
          }
        }),
      hideTab: (tab: Tab) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.address === tab.address ? { ...t, displayed: false } : t)),
          currentTab: DEFAULT_TAB,
        })),
      deleteTab: (address: string) =>
        set((state) => {
          // Don't delete mandatory tabs
          const filteredTabs = state.tabs.filter((tab) => {
            if (tab.name === GLOBAL_CHANNEL_KEY) return true;
            return tab.address !== address;
          });

          return {
            tabs: filteredTabs,
            currentTab: state.currentTab.address === address ? DEFAULT_TAB : state.currentTab,
          };
        }),
      changeTabByAddress: (address: string) =>
        set((state) => {
          const tab = state.tabs.find((tab) => tab.address === address);
          return tab ? { currentTab: tab } : state;
        }),
    }),
    {
      name: CHAT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
