import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { chatAlertOpening, useChatAlertPresses } from "@/pwa/chat-alert-press";
import { usePushDeviceId } from "@/pwa/use-push-device-id";
import { useChatRevealed } from "@/ui/features/social/realtime-chat/hooks/use-chat-revealed";
import { useSeenRoom } from "@/ui/features/social/realtime-chat/hooks/use-seen-room";
import { useRequestSignIn } from "@/shell/sign-in/connect";
import { resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPanel, HudPill } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import {
  GameChatMap,
  RealtimeChatShell,
  type InitializeRealtimeClientParams,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
} from "@/ui/features/social";
import type { RealtimeConnectionStatus } from "@/ui/features/social/realtime-chat/model/types";
import { chatRooms } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import { chatUnread } from "@/ui/features/social/realtime-chat/model/direct-unread";
import { messageWords, placeOf } from "@/ui/features/social/realtime-chat/model/place";
import { usePlaceReader } from "@/ui/features/social/realtime-chat/ui/shared/use-chat-map";
import { configManager, nativeGameModeOf } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import { useEffect, useMemo, useRef } from "react";
import { getActiveGame } from "@/runtime/world";
import { isKeyForSurface } from "@/utils/shortcuts/typing-target";
import { CHAT_SHORTCUT } from "./chat-shortcut";

/** A game's chat room: game ids repeat across shards, so a room is named by its shard's chain and the game. */
export const gameChatZoneId = (chainId: string, gameId: number) => `game:0x${BigInt(chainId).toString(16)}:${gameId}`;

/**
 * The chat as the player stands in a game: signed in or not, the rooms they have there (chatRooms: Global, and the
 * game's own only where its mode keeps one), the room the strip reads, and what joining them takes.
 */
const useGameChatRoom = () => {
  const { status } = useIdentitySession();
  const signedIn = status === "signed-in";
  const game = getActiveGame();
  const gameZoneId = game ? gameChatZoneId(game.chainId, configManager.getActiveGameId()) : "";
  const rooms = useMemo(
    () => chatRooms(game ? { zoneId: gameZoneId, mode: nativeGameModeOf(game.presetId) } : null),
    [game, gameZoneId],
  );
  const zoneId = useRealtimeChatSelector((state) =>
    rooms.some((room) => room.zoneId === state.activeZoneId) ? state.activeZoneId! : GLOBAL_CHAT_CHANNEL_ID,
  );
  // The rooms shown are the rooms opened: one list for the tabs and the sockets.
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (signedIn ? { baseUrl: window.location.origin, rooms: rooms.map((room) => room.zoneId) } : null),
    [signedIn, rooms],
  );
  return { status, rooms, zoneId, initializer };
};

/**
 * The game's chat connection, held once for the whole game, whichever HUD composition draws chat (a desktop's rail, a
 * phone's page or sheet): it joins the room once the player is signed in and loads the room's history on connect, so
 * the strip shows the last message before chat was ever opened. Mounted once beside the HUD; a layout change swaps
 * the views, never the connection, so the room, its history and its unread count carry over.
 */
export function GameChatConnection() {
  const { initializer, zoneId } = useGameChatRoom();
  useRealtimeChatInitializer(initializer);
  useSeenRoom(usePushDeviceId(notificationOwnerOf(useIdentitySession().session)));
  // A chat alert pressed brings this game forward: chat opens on what it is about, the game left as it is.
  const openAlert = useRealtimeChatSelector((state) => state.actions.openAlert);
  useChatAlertPresses((press) => {
    const opening = chatAlertOpening(press);
    if (!("page" in opening)) openAlert(opening);
  });
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const hasGameChat = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  const loadWorldHistory = useRealtimeChatSelector((state) => state.actions.loadWorldHistory);
  useEffect(() => {
    if (initializer && connection === "connected" && hasGameChat) void loadWorldHistory({ zoneId, limit: 10 });
  }, [initializer, connection, hasGameChat, loadWorldHistory, zoneId]);
  return null;
}

/**
 * The game's chat as a view reads it: the room, the strip's line (chatStripLine) and unread count, and the room marked
 * read while `open`. Every view that shows chat reads it here; the connection itself is GameChatConnection's.
 */
export function useGameChat(open: boolean) {
  const { status, rooms, zoneId, initializer } = useGameChatRoom();
  const requestSignIn = useRequestSignIn();
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const hasGameChat = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  // The strip reads the room's last message from a player not muted, once who is muted is known.
  const lastMessage = useRealtimeChatSelector((state) =>
    state.worldZones[zoneId]?.messages.findLast(
      (message) => state.blockList !== null && !state.blockList.blocked.includes(message.sender.playerId),
    ),
  );
  // The strip names a place as its chip does: one reading of it.
  const readPlace = usePlaceReader();
  const lastPlace = lastMessage ? placeOf(lastMessage.metadata) : null;
  const history = useRealtimeChatSelector((state) => historyState(state.worldZones[zoneId]));
  const unread = useRealtimeChatSelector(chatUnread);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  useEffect(() => {
    setShellOpen(open);
    return () => setShellOpen(false);
  }, [open, setShellOpen]);

  // The strip names the last sender, and draws again when a name lands.
  const names = usePlayerNames();
  const stripLine = chatStripLine({
    signedIn: initializer !== null,
    connection,
    hasGameChat,
    history,
    last:
      lastMessage &&
      `${resolveChatSenderName(names, lastMessage.sender.playerId, lastMessage.sender.displayName)}: ${messageWords(lastMessage.content, lastPlace?.name ?? null, lastPlace ? readPlace(lastPlace).name : null)}`,
  });
  return { status, initializer, requestSignIn, rooms, unread, stripLine };
}

/** Where the room's history stands: not answered yet, answered (with or without messages), or failed. */
type HistoryState = "loading" | "answered" | "failed";
const historyState = (zone: { historyError?: string; lastFetchedCursor?: string | null } | undefined): HistoryState =>
  zone?.historyError ? "failed" : zone?.lastFetchedCursor !== undefined ? "answered" : "loading";

/**
 * What the chat strip says, from what chat has actually told: the last message once one is known; that chat is
 * unavailable when the room is not joined, the connection failed or the history read failed; "No messages yet" only
 * once the room's history answered with none; and that it is loading until then, never an empty room it has not read.
 */
const chatStripLine = ({
  signedIn,
  connection,
  hasGameChat,
  history,
  last,
}: {
  signedIn: boolean;
  connection: RealtimeConnectionStatus;
  hasGameChat: boolean;
  history: HistoryState;
  last: string | undefined;
}): string => {
  if (!signedIn) return CHAT_WORDS.signInToChat;
  if (connection === "connected" && !hasGameChat) return CHAT_UNAVAILABLE;
  if (last) return last;
  if (connection === "error" || history === "failed") return CHAT_UNAVAILABLE;
  return history === "answered" ? "No messages yet" : "Loading chat…";
};
const CHAT_UNAVAILABLE = "Chat unavailable";

/** The strip at the foot of the right column: last message and unread count, on the sheet's strip so it reads over any
 *  ground the map shows under it, and pressable once the player's identity has loaded. Open, a pane rises above it, as
 *  tall as `chat-pane` while there is room; in a column short of room it gives up height with what stands above it,
 *  down to `chat-least` (the rail's stacking rule). `foldToIcon` shrinks the strip to its icon and unread count on a
 *  phone held upright, when something else needs the room. */
export function HudChatWindow({
  open,
  onOpenChange,
  foldToIcon = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foldToIcon?: boolean;
}) {
  const { status, initializer, requestSignIn, rooms, unread, stripLine } = useGameChat(open);
  const pane = useRef<HTMLDivElement>(null);
  useChatRevealed(() => onOpenChange(true));

  useEffect(() => {
    if (open) pane.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus();
  }, [open]);
  useEffect(() => {
    if (!initializer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        // A field with its list open (chat's mentions) puts the list away first.
        if (event.target instanceof Element && event.target.closest('[aria-expanded="true"]')) return;
        event.stopImmediatePropagation();
        onOpenChange(false);
        return;
      }
      if (event.key !== CHAT_SHORTCUT.key || open || event.repeat || event.defaultPrevented) return;
      if (isKeyForSurface(event)) return;
      event.preventDefault();
      onOpenChange(true);
    };
    const onMapPointerDown = (event: PointerEvent) => {
      if (open && event.target instanceof HTMLCanvasElement) onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onMapPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onMapPointerDown, true);
    };
  }, [initializer, onOpenChange, open]);

  return (
    <div className={cn("mt-auto flex flex-col gap-2", open ? "min-h-hud-chat-least" : "shrink-0")}>
      {open && (
        <div ref={pane} className="pointer-events-auto flex h-hud-chat-pane min-h-0 flex-col">
          <HudPanel
            label="Chat"
            collapsible={false}
            className="min-h-0 flex-1"
            // The chat shell pads its own tabs, history and composer.
            bodyClassName="flex min-h-0 flex-1 flex-col p-0"
          >
            <GameChatMap>
              <RealtimeChatShell rooms={rooms} className="min-h-0 flex-1" />
            </GameChatMap>
          </HudPanel>
        </div>
      )}
      <div className={cn("pointer-events-auto shrink-0", foldToIcon && "portrait:w-auto portrait:self-start")}>
        <HudPill
          label="Chat strip"
          aria-expanded={open}
          className="max-w-full"
          // A signed-out spectator's strip is their way into the sign-in flow, which brings them back to this game.
          onPress={status === "loading" ? undefined : () => (initializer ? onOpenChange(!open) : requestSignIn())}
        >
          {[
            <span key="last" className="flex min-w-0 items-center gap-1.5">
              <Icon name="chat" size={20} />
              <span className={cn("min-w-0 truncate", foldToIcon && "portrait:sr-only")}>{stripLine}</span>
            </span>,
            ...(initializer && !open && unread > 0
              ? [
                  <HudChip key="unread" label="Unread chat messages">
                    {unread}
                  </HudChip>,
                ]
              : []),
          ]}
        </HudPill>
      </div>
    </div>
  );
}
