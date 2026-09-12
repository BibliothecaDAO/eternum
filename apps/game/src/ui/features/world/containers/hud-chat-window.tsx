import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolveChatSenderName } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  RealtimeChatShell,
  type InitializeRealtimeClientParams,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
} from "@/ui/features/social";
import { configManager } from "@bibliothecadao/eternum";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { useEffect, useMemo, useRef } from "react";
import { env } from "../../../../../env";
import { CHAT_SHORTCUT } from "./chat-shortcut";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"]') !== null;

/** The strip at the foot of the right column: last message and unread count. Open, a fixed-height pane rises
 *  above the strip and the details above keep whatever room is left. */
export function HudChatWindow({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const address = useAccountStore((state) => state.account?.address);
  const gameZoneId = `game:${configManager.getActiveGameId()}`;
  const zoneId = useRealtimeChatSelector((state) =>
    state.activeZoneId === gameZoneId ? gameZoneId : GLOBAL_CHAT_CHANNEL_ID,
  );
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (address && env.VITE_PUBLIC_CHAT_URL ? { baseUrl: env.VITE_PUBLIC_CHAT_URL, joinZones: [gameZoneId] } : null),
    [address, gameZoneId],
  );
  useRealtimeChatInitializer(initializer);
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const hasGameChat = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  const loadWorldHistory = useRealtimeChatSelector((state) => state.actions.loadWorldHistory);
  const lastMessage = useRealtimeChatSelector((state) => state.worldZones[zoneId]?.messages.at(-1));
  const unread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  const pane = useRef<HTMLElement>(null);

  // The strip shows the last message before the chat was ever opened, so history loads on connect.
  useEffect(() => {
    if (initializer && connection === "connected" && hasGameChat) void loadWorldHistory({ zoneId, limit: 10 });
  }, [initializer, connection, hasGameChat, loadWorldHistory, zoneId]);
  useEffect(() => {
    setShellOpen(open);
    return () => setShellOpen(false);
  }, [open, setShellOpen]);
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
      if (isTypingTarget(event.target)) return;
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

  const stripText = !initializer
    ? "Sign in to chat"
    : connection === "connected" && !hasGameChat
      ? "Chat unavailable"
      : lastMessage
        ? `${resolveChatSenderName(lastMessage.sender.playerId, lastMessage.sender.displayName)}: ${lastMessage.content}`
        : "No messages yet";

  return (
    <div className="mt-auto flex shrink-0 flex-col gap-2">
      {open && (
        <section
          ref={pane}
          aria-label="Chat"
          className={cn(
            "pointer-events-auto flex h-[min(60vh,520px)] shrink-0 flex-col overflow-hidden rounded-xl",
            OVERLAY_SURFACE_BASE,
          )}
        >
          <RealtimeChatShell
            defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
            gameZoneId={gameZoneId}
            displayMode="embedded"
            autoInitializeClient={false}
            showInlineToggle={false}
            className="min-h-0 flex-1"
          />
        </section>
      )}
      <button
        type="button"
        aria-label="Chat strip"
        aria-expanded={open}
        disabled={!initializer}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "pointer-events-auto flex h-8 w-full shrink-0 items-center gap-2 rounded-xl px-3 text-left font-sans normal-case tracking-normal",
          OVERLAY_SURFACE_BASE,
          initializer ? "hover:border-gold/50" : "cursor-default",
        )}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gold/70" />
        <span className={cn("min-w-0 flex-1 truncate", HUD_BODY)}>{stripText}</span>
        {initializer && !open && unread > 0 && (
          <span aria-label="Unread chat messages" className="rounded-full bg-gold px-1.5 text-[10px] text-dark-brown">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
