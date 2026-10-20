import { useIdentitySession } from "@/hooks/context/identity-session";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";
import { resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPanel, HudPill } from "@/ui/design-system/kit/hud-elements";
import {
  RealtimeChatShell,
  type InitializeRealtimeClientParams,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
} from "@/ui/features/social";
import { configManager } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import { useEffect, useMemo, useRef } from "react";
import { getActiveGame } from "@/runtime/world";
import { isKeyForSurface } from "@/utils/shortcuts/typing-target";
import { CHAT_SHORTCUT } from "./chat-shortcut";

/**
 * The game's chat room as the player stands in it: signed in or not, the room's name (game ids repeat across shards,
 * so a room is named by its shard's chain and the game), the zone shown, and what joining it takes.
 */
const useGameChatRoom = () => {
  const { status } = useIdentitySession();
  const signedIn = status === "signed-in";
  const game = getActiveGame();
  const gameZoneId = game ? `game:0x${BigInt(game.chainId).toString(16)}:${configManager.getActiveGameId()}` : "";
  const zoneId = useRealtimeChatSelector((state) =>
    state.activeZoneId === gameZoneId ? gameZoneId : GLOBAL_CHAT_CHANNEL_ID,
  );
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (signedIn ? { baseUrl: window.location.origin, joinZones: gameZoneId ? [gameZoneId] : [] } : null),
    [signedIn, gameZoneId],
  );
  return { status, gameZoneId, zoneId, initializer };
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
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const hasGameChat = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  const loadWorldHistory = useRealtimeChatSelector((state) => state.actions.loadWorldHistory);
  useEffect(() => {
    if (initializer && connection === "connected" && hasGameChat) void loadWorldHistory({ zoneId, limit: 10 });
  }, [initializer, connection, hasGameChat, loadWorldHistory, zoneId]);
  return null;
}

/**
 * The game's chat as a view reads it: the room, the connection, its last message and unread count, and the room
 * marked read while `open`. Every view that shows chat reads it here; the connection itself is GameChatConnection's.
 */
export function useGameChat(open: boolean) {
  const { status, gameZoneId, zoneId, initializer } = useGameChatRoom();
  const requestSignIn = useRequestSignIn();
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const hasGameChat = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  const lastMessage = useRealtimeChatSelector((state) => state.worldZones[zoneId]?.messages.at(-1));
  const unread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  useEffect(() => {
    setShellOpen(open);
    return () => setShellOpen(false);
  }, [open, setShellOpen]);

  return { status, initializer, requestSignIn, gameZoneId, connection, hasGameChat, lastMessage, unread };
}

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
  const { status, initializer, requestSignIn, gameZoneId, connection, hasGameChat, lastMessage, unread } =
    useGameChat(open);
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) pane.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus();
  }, [open]);
  useEffect(() => {
    if (!initializer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
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

  // The strip names the last sender, and draws again when a name lands.
  const names = usePlayerNames();
  const stripText = !initializer
    ? "Sign in to chat"
    : connection === "connected" && !hasGameChat
      ? "Chat unavailable"
      : lastMessage
        ? `${resolveChatSenderName(names, lastMessage.sender.playerId, lastMessage.sender.displayName)}: ${lastMessage.content}`
        : "No messages yet";

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
            <RealtimeChatShell
              defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
              gameZoneId={gameZoneId}
              displayMode="embedded"
              autoInitializeClient={false}
              showInlineToggle={false}
              className="min-h-0 flex-1"
            />
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
              <span className={cn("min-w-0 truncate", foldToIcon && "portrait:sr-only")}>{stripText}</span>
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
