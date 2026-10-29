import { useMemo } from "react";
import { create } from "zustand";

import { type ChatRoom, GLOBAL_ROOM } from "@/ui/features/social/realtime-chat/model/chat-rooms";

/**
 * Where the app's chat stands: the room a page adds (a Blitz lobby's, while its page is open, which shows the chat
 * itself), and whether the desktop's pane is open.
 */
export const useAppChatPlace = create<{ lobby: ChatRoom | null; paneOpen: boolean }>(() => ({
  lobby: null,
  paneOpen: false,
}));

/** The app's rooms where the player stands: a lobby's room first on its page, and Global everywhere. */
export const useAppChatRooms = (): ChatRoom[] => {
  const lobby = useAppChatPlace((state) => state.lobby);
  return useMemo(() => (lobby ? [lobby, GLOBAL_ROOM] : [GLOBAL_ROOM]), [lobby]);
};

/** Whether the page shows the chat itself (a lobby's), so the desktop's bar offers no pane over it. */
export const useChatOnPage = () => useAppChatPlace((state) => state.lobby !== null);

/** The desktop's pane: whether it is open, and the bar's Chat, which opens and closes it. */
export const useAppChatPane = () => {
  const open = useAppChatPlace((state) => state.paneOpen);
  return { open, toggle: () => useAppChatPlace.setState({ paneOpen: !open }) };
};
