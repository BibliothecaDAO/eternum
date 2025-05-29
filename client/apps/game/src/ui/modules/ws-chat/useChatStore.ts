import { create } from "zustand";
import { User } from "./types/user";

interface ChatTab {
  id: string;
  type: "global" | "room" | "direct";
  name: string;
  roomId?: string;
  recipientId?: string;
  unreadCount: number;
}

interface ChatStoreState {
  isExpanded: boolean;
  isMinimized: boolean;
  activeTabId: string | null;
  tabs: ChatTab[];
  isLoadingMessages: boolean;
  onlineUsers: User[];
  offlineUsers: User[];
  isLoadingUsers: boolean;
  actions: {
    toggleExpand: () => void;
    setMinimized: (minimized: boolean) => void;
    openChat: () => void;
    addTab: (tab: Omit<ChatTab, "id" | "unreadCount">) => void;
    removeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    updateTabUnreadCount: (tabId: string, count: number) => void;
    setIsLoadingMessages: (loading: boolean) => void;
    setOnlineUsers: (users: User[]) => void;
    setOfflineUsers: (users: User[]) => void;
    setIsLoadingUsers: (loading: boolean) => void;
    getUserIdByUsername: (username: string) => string | null;
  };
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  isExpanded: false,
  isMinimized: false,
  activeTabId: null,
  tabs: [],
  isLoadingMessages: true,
  onlineUsers: [],
  offlineUsers: [],
  isLoadingUsers: true,
  actions: {
    toggleExpand: () => set((state) => ({ isExpanded: !state.isExpanded, isMinimized: false })),
    setMinimized: (minimized) => set({ isMinimized: minimized }),
    openChat: () => set({ isMinimized: false }),
    addTab: (tab) => {
      const newTab: ChatTab = {
        ...tab,
        id: `${tab.type}-${tab.type === "room" ? tab.roomId : tab.type === "direct" ? tab.recipientId : "global"}`,
        unreadCount: 0,
      };

      set((state) => {
        // Check if tab with same id already exists
        const existingTab = state.tabs.find((t) => t.id === newTab.id);
        if (existingTab) {
          // If tab exists, just make it active
          return {
            activeTabId: existingTab.id,
            isMinimized: false,
            isLoadingMessages: true,
          };
        }

        // If tab doesn't exist, add it
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
          isMinimized: false,
          isLoadingMessages: true,
        };
      });
    },
    removeTab: (tabId) => {
      set((state) => {
        const newTabs = state.tabs.filter((tab) => tab.id !== tabId);
        const newActiveTabId =
          state.activeTabId === tabId ? (newTabs.length > 0 ? newTabs[0].id : null) : state.activeTabId;

        // Only set loading state if we're switching to a new tab
        const isLoading = state.activeTabId === tabId && newActiveTabId !== tabId;

        return {
          tabs: newTabs,
          activeTabId: newActiveTabId,
          isLoadingMessages: isLoading,
        };
      });
    },
    setActiveTab: (tabId) => {
      set((state) => ({
        activeTabId: tabId,
        isMinimized: false,
        isLoadingMessages: true,
      }));
    },
    updateTabUnreadCount: (tabId, count) => {
      set((state) => ({
        tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, unreadCount: count } : tab)),
      }));
    },
    setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
    setOnlineUsers: (users) => set({ onlineUsers: users }),
    setOfflineUsers: (users) => set({ offlineUsers: users }),
    setIsLoadingUsers: (loading) => set({ isLoadingUsers: loading }),
    getUserIdByUsername: (username: string) => {
      const allUsers = [...get().onlineUsers, ...get().offlineUsers];
      const user = allUsers.find((user) => user?.username?.toLowerCase() === username?.toLowerCase());
      return user?.id || null;
    },
  },
}));
