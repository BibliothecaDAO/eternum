import { useEffect, useMemo } from "react";
import { create } from "zustand";

import { type ChatRoom, GLOBAL_ROOM } from "@/ui/features/social/realtime-chat/model/chat-rooms";

/** Where the app's chat stands. */
type AppChatPlace = {
  /** The room a page adds: a Blitz lobby's, while its page is open. */
  lobby: ChatRoom | null;
  /** How many pages draw the chat themselves now (Chat's own page, a lobby's): while one does, there is no pane. */
  pages: number;
  /** How many chats are drawn now, a page's or the pane: chat is open, the room it shows read, while one is. */
  shown: number;
  /** Whether the desktop's pane is open. */
  paneOpen: boolean;
};

export const useAppChatPlace = create<AppChatPlace>(() => ({ lobby: null, pages: 0, shown: 0, paneOpen: false }));

/** The app's rooms where the player stands: a lobby's room first on its page, and Global everywhere. */
export const useAppChatRooms = (): ChatRoom[] => {
  const lobby = useAppChatPlace((state) => state.lobby);
  return useMemo(() => (lobby ? [lobby, GLOBAL_ROOM] : [GLOBAL_ROOM]), [lobby]);
};

/** Whether the page draws the chat itself (Chat's page, a lobby's), so no pane stands over it. */
export const useChatOnPage = () => useAppChatPlace((state) => state.pages > 0);

/** A page that draws the chat itself, while it stands: the pane closes, and the bar offers none. */
export const useChatPage = () =>
  useEffect(() => {
    useAppChatPlace.setState((state) => ({ pages: state.pages + 1, paneOpen: false }));
    return () => useAppChatPlace.setState((state) => ({ pages: state.pages - 1 }));
  }, []);

/** One chat drawn, while it stands. */
export const useChatShown = () =>
  useEffect(() => {
    useAppChatPlace.setState((state) => ({ shown: state.shown + 1 }));
    return () => useAppChatPlace.setState((state) => ({ shown: state.shown - 1 }));
  }, []);

/** The desktop's pane: whether it is open, and the bar's Chat, which opens and closes it. */
export const useAppChatPane = () => {
  const open = useAppChatPlace((state) => state.paneOpen);
  return { open, toggle: () => useAppChatPlace.setState({ paneOpen: !open }) };
};
