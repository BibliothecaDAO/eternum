import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { chatAlertOpening, useChatAlertPresses } from "@/pwa/chat-alert-press";
import { usePushDeviceId } from "@/pwa/use-push-device-id";
import { useChatRevealed } from "@/ui/features/social/realtime-chat/hooks/use-chat-revealed";
import { CHAT_PATH } from "@bibliothecadao/notifications";
import { layoutNow } from "../frame/layout";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { AppButton, AppIconButton, AppPanel } from "@/ui/design-system/kit/app-elements";
import { CHAT_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { RealtimeChatShell, useRealtimeChatInitializer, useRealtimeChatSelector } from "@/ui/features/social";
import { useSeenRoom } from "@/ui/features/social/realtime-chat/hooks/use-seen-room";
import { lobbyRoom } from "@/ui/features/social/realtime-chat/model/chat-rooms";

import { useRequestSignIn } from "../sign-in/connect";
import {
  useAppChatPane,
  useAppChatPlace,
  useAppChatRooms,
  useChatOnPage,
  useChatPage,
  useChatShown,
} from "./app-chat-place";

/**
 * The app's one chat connection, while a player is signed in: the same chat as a game's (one implementation), on the
 * app's origin, its rooms moving with the player (a lobby's room joins on the lobby's page) on the one connection.
 */
export const AppChatConnection = () => {
  const rooms = useAppChatRooms();
  const config = useMemo(() => ({ baseUrl: window.location.origin, rooms: rooms.map((room) => room.zoneId) }), [rooms]);
  useRealtimeChatInitializer(config);
  useSeenRoom(usePushDeviceId(notificationOwnerOf(useIdentitySession().session)));
  // A chat alert pressed brings the app forward on what it is about: a lobby's page (whose room it opens), or chat on
  // its room or conversation, on the page that shows chat, else the desktop's pane or the phone's Chat page.
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const openAlert = useRealtimeChatSelector((state) => state.actions.openAlert);
  useChatAlertPresses((press) => {
    const opening = chatAlertOpening(press);
    if (!("page" in opening)) return openAlert(opening);
    const { lobby } = useAppChatPlace.getState();
    if (pathname === opening.page && lobby) openAlert({ room: lobby.zoneId });
    else navigate(opening.page);
  });
  useChatRevealed(() => {
    if (useAppChatPlace.getState().pages > 0) return;
    if (layoutNow() === "desktop") useAppChatPlace.setState({ paneOpen: true });
    else navigate(CHAT_PATH);
  });
  // Chat is open while any chat is drawn, whichever went first: a page's and the pane's never answer for each other.
  const shown = useAppChatPlace((state) => state.shown > 0);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  useEffect(() => {
    setShellOpen(shown);
  }, [setShellOpen, shown]);
  return null;
};

/**
 * The chat drawn in the app: the one chat shell in the app's colours ([data-hud-mode="app"]), read while it shows.
 * Signed out, the way into sign-in.
 */
const AppChatView = ({ className }: { className?: string }) => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const rooms = useAppChatRooms();
  useChatShown();
  return (
    <div data-hud-mode="app" className={cn("flex min-h-0 flex-col", className)}>
      {session ? (
        <RealtimeChatShell rooms={rooms} className="min-h-0 flex-1" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <p className="text-app-body text-app-muted">{CHAT_WORDS.signInToChat}</p>
          {status !== "loading" && (
            <AppButton kind="primary" onClick={() => requestSignIn()}>
              {WORDS.connect}
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Chat as a page (/chat: the phone's Chat tab, and on a desktop the bar's Chat lit there): it fills the page between
 * the top and the tabs, and no pane stands over it.
 */
export const AppChatPage = () => {
  useChatPage();
  return <AppChatView className="h-full" />;
};

/**
 * Chat over a desktop page (the bar's Chat), at the page's right, as in a game: its rooms and Messages, closed by the
 * cross in its head or Escape. A page that draws the chat itself (Chat's, a lobby's) has no pane.
 */
export const AppChatPane = () => {
  const { open, toggle } = useAppChatPane();
  const onPage = useChatOnPage();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") useAppChatPlace.setState({ paneOpen: false });
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (!open || onPage) return null;
  return (
    <AppPanel
      icon="chat"
      title={CHAT_WORDS.chat}
      label={CHAT_WORDS.chat}
      cue={<AppIconButton icon="close" label={CHAT_WORDS.closeChat} onClick={toggle} />}
      flush
      fill
      className="fixed bottom-4 right-4 z-40 h-[min(40rem,calc(100dvh-7rem))] w-[26rem]"
    >
      <AppChatView className="flex-1" />
    </AppPanel>
  );
};

/**
 * A Blitz lobby's chat, on its page: the one chat with the lobby's room first (any signed-in player reads it; a player
 * registered in the slot writes, as the room answers at its open), opened on that room. `membership` names what the
 * room's answer was taken on (the payout wallet and its registration): the room is opened again when it changes.
 */
export const LobbyChat = ({ slot, membership }: { slot: { chainId: string; name: string }; membership: string }) => {
  const { chainId, name } = slot;
  const room = useMemo(() => lobbyRoom({ chainId, name }), [chainId, name]);
  const actions = useRealtimeChatSelector((state) => state.actions);
  useChatPage();
  useEffect(() => {
    useAppChatPlace.setState({ lobby: room });
    actions.showRoom(room.zoneId);
    return () => useAppChatPlace.setState({ lobby: null });
  }, [actions, room]);
  const answeredOn = useRef(membership);
  useEffect(() => {
    if (answeredOn.current === membership) return;
    answeredOn.current = membership;
    actions.reopenRoom(room.zoneId);
  }, [actions, membership, room]);
  return (
    <AppPanel icon="chat" title={CHAT_WORDS.chat} label={CHAT_WORDS.chat} flush fill className="h-[28rem]">
      <AppChatView className="flex-1" />
    </AppPanel>
  );
};
