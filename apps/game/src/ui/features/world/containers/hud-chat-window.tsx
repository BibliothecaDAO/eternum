import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { chatAlertOpening, useChatAlertPresses } from "@/pwa/chat-alert-press";
import { usePushDeviceId } from "@/pwa/use-push-device-id";
import { useChatRevealed } from "@/ui/features/social/realtime-chat/hooks/use-chat-revealed";
import { useSeenRoom } from "@/ui/features/social/realtime-chat/hooks/use-seen-room";
import { useRequestSignIn } from "@/shell/sign-in/connect";
import { getGameModeId } from "@/config/game-modes";
import {
  GameChatMap,
  RealtimeChatShell,
  type InitializeRealtimeClientParams,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
} from "@/ui/features/social";
import { chatRooms, gameAspectRooms } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import { useGrantedRooms } from "@/ui/features/social/realtime-chat/hooks/use-granted-rooms";
import { ChatDock, useChatStrip } from "@/ui/features/social/realtime-chat/ui/chat-dock";
import { usePlaceReader } from "@/ui/features/social/realtime-chat/ui/shared/use-chat-map";
import { configManager } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import { useEffect, useMemo } from "react";

import { CLICK_SLOP_PX } from "@/three/managers/map-click";
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
  const granted = useGrantedRooms();
  const rooms = useMemo(
    () => [
      ...(game ? gameAspectRooms(granted, { chainId: game.chainId, gameId: configManager.getActiveGameId() }) : []),
      ...chatRooms(game ? { zoneId: gameZoneId, mode: getGameModeId() } : null),
    ],
    [game, gameZoneId, granted],
  );
  const zoneId = useRealtimeChatSelector((state) =>
    rooms.some((room) => room.zoneId === state.activeZoneId) ? state.activeZoneId! : GLOBAL_CHAT_CHANNEL_ID,
  );
  // The rooms shown are the rooms opened: one list for the tabs and the sockets.
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (signedIn ? { baseUrl: window.location.origin, rooms: rooms.map((room) => room.zoneId) } : null),
    [signedIn, rooms],
  );
  return { rooms, zoneId, initializer };
};

/**
 * The game's chat connection, held once for the whole game, whichever HUD composition draws chat (a desktop's rail, a
 * phone's page or sheet): it joins the room once the player is signed in and loads the room's history on connect, so
 * the strip shows the last message before chat was ever opened. Mounted once beside the HUD; a layout change swaps
 * the views, never the connection, so the room, its history and its unread count carry over.
 */
export function GameChatConnection() {
  const { initializer } = useGameChatRoom();
  useRealtimeChatInitializer(initializer);
  useSeenRoom(usePushDeviceId(notificationOwnerOf(useIdentitySession().session)));
  // A chat alert pressed brings this game forward: chat opens on what it is about, the game left as it is.
  const openAlert = useRealtimeChatSelector((state) => state.actions.openAlert);
  useChatAlertPresses((press) => {
    const opening = chatAlertOpening(press);
    if (!("page" in opening)) openAlert(opening);
  });
  return null;
}

export function useGameChat(open: boolean) {
  const { rooms, zoneId, initializer } = useGameChatRoom();
  const requestSignIn = useRequestSignIn();
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  useEffect(() => {
    setShellOpen(open);
    return () => setShellOpen(false);
  }, [open, setShellOpen]);
  const readPlace = usePlaceReader();
  const { stripLine, unread } = useChatStrip({
    zoneId,
    signedIn: initializer !== null,
    readPlace: (place) => readPlace(place).name,
  });
  return { initializer, requestSignIn, rooms, unread, stripLine };
}

export function HudChatWindow({
  open,
  onOpenChange,
  foldToIcon = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foldToIcon?: boolean;
}) {
  const { initializer, requestSignIn, rooms, unread, stripLine } = useGameChat(open);
  useChatRevealed(() => onOpenChange(true));

  useEffect(() => {
    if (!initializer) return;
    // Escape and system back close the open pane as they close every frame (HudPage).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== CHAT_SHORTCUT.key || open || event.repeat || event.defaultPrevented) return;
      if (isKeyForSurface(event)) return;
      event.preventDefault();
      onOpenChange(true);
    };
    // A click on the map puts chat away, as the map takes it to pick what is under it; a drag only moves the map, so
    // chat stays open over it (playtest 29 October 2026: a place shared, the map dragged, the place opened from chat).
    let press: { id: number; x: number; y: number; dragged: boolean } | null = null;
    const onMapPointerDown = (event: PointerEvent) => {
      press =
        open && event.target instanceof HTMLCanvasElement
          ? { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
          : null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PX)
        press.dragged = true;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return;
      const clicked = !press.dragged && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= CLICK_SLOP_PX;
      press = null;
      if (clicked) onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onMapPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onMapPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [initializer, onOpenChange, open]);

  return (
    <ChatDock
      open={open}
      onOpenChange={onOpenChange}
      signedIn={initializer !== null}
      onSignIn={() => requestSignIn()}
      stripLine={stripLine}
      unread={unread}
      foldToIcon={foldToIcon}
      className="mt-auto"
    >
      <GameChatMap>
        <RealtimeChatShell rooms={rooms} className="min-h-0 flex-1" />
      </GameChatMap>
    </ChatDock>
  );
}
