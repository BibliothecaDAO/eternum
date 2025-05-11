import { create } from "zustand";
import { User } from "./types/user";

interface ChatStoreState {
  isExpanded: boolean;
  isMinimized: boolean;
  activeView: "global" | "room" | "direct";
  activeRoomId: string | null;
  directMessageRecipientId: string | null;
  isLoadingMessages: boolean; // Keep track of loading state for messages
  onlineUsers: User[];
  offlineUsers: User[];
  isLoadingUsers: boolean;
  actions: {
    toggleExpand: () => void;
    setMinimized: (minimized: boolean) => void;
    openChat: () => void; // Will ensure chat is not minimized
    switchToGlobalChat: () => void;
    selectRoom: (roomId: string) => void;
    selectDirectMessageRecipient: (userId: string) => void;
    setIsLoadingMessages: (loading: boolean) => void;
    setOnlineUsers: (users: User[]) => void;
    setOfflineUsers: (users: User[]) => void;
    setIsLoadingUsers: (loading: boolean) => void;
    getUserIdByUsername: (username: string) => string | null;
  };
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  isExpanded: false,
  isMinimized: true, // Start minimized by default
  activeView: "global",
  activeRoomId: null,
  directMessageRecipientId: null,
  isLoadingMessages: true, // Initial state, will be updated by ChatModule
  onlineUsers: [],
  offlineUsers: [],
  isLoadingUsers: true,
  actions: {
    toggleExpand: () => set((state) => ({ isExpanded: !state.isExpanded, isMinimized: false })),
    setMinimized: (minimized) => set({ isMinimized: minimized }),
    openChat: () => set({ isMinimized: false }),
    switchToGlobalChat: () =>
      set({
        activeView: "global",
        activeRoomId: null,
        directMessageRecipientId: null,
        isMinimized: false,
        isLoadingMessages: true,
      }),
    selectRoom: (roomId) =>
      set({
        activeView: "room",
        activeRoomId: roomId,
        directMessageRecipientId: null,
        isMinimized: false,
        isLoadingMessages: true,
      }),
    selectDirectMessageRecipient: (userId) =>
      set({
        activeView: "direct",
        directMessageRecipientId: userId,
        activeRoomId: null,
        isMinimized: false,
        isLoadingMessages: true,
      }),
    setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
    setOnlineUsers: (users) => set({ onlineUsers: users }),
    setOfflineUsers: (users) => set({ offlineUsers: users }),
    setIsLoadingUsers: (loading) => set({ isLoadingUsers: loading }),
    getUserIdByUsername: (username: string) => {
      const allUsers = [...get().onlineUsers, ...get().offlineUsers];

      const user = allUsers.filter((user) => user.username === username);
      console.log("user", user);
      return user[0]?.id || null;
    },
  },
}));
