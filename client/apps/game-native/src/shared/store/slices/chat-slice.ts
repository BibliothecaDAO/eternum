export interface ChatSlice {
  chatUnreadCounts: Record<string, number>;
  setChatUnread: (userId: string, count: number) => void;
  markChatAsRead: (userId: string) => void;
  clearAllChatUnread: () => void;
}

export const createChatSlice = (set: any): ChatSlice => ({
  chatUnreadCounts: {},
  setChatUnread: (userId: string, count: number) =>
    set((state: ChatSlice) => ({
      chatUnreadCounts: {...state.chatUnreadCounts, [userId]: count},
    })),
  markChatAsRead: (userId: string) =>
    set((state: ChatSlice) => {
      const next = {...state.chatUnreadCounts};
      delete next[userId];
      return {chatUnreadCounts: next};
    }),
  clearAllChatUnread: () => set({chatUnreadCounts: {}}),
});
