import { useAccountStore } from "@/hooks/store/use-account-store";
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
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../../../../env";
import { CHAT_SHORTCUT } from "./chat-shortcut";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"]') !== null;

/** One strip at the foot of the right column: the last message and the unread count. It expands over the tile details. */
export function HudChatWindow() {
  const address = useAccountStore((state) => state.account?.address);
  const zoneId = `game:${configManager.getActiveGameId()}`;
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (address && env.VITE_PUBLIC_CHAT_URL ? { baseUrl: env.VITE_PUBLIC_CHAT_URL, joinZones: [zoneId] } : null),
    [address, zoneId],
  );
  useRealtimeChatInitializer(initializer);
  const [open, setOpen] = useState(false);
  const lastMessage = useRealtimeChatSelector((state) => state.worldZones[zoneId]?.messages.at(-1));
  const unread = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  const pane = useRef<HTMLElement>(null);

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
        setOpen(false);
        return;
      }
      if (event.key !== CHAT_SHORTCUT.key || open || event.repeat || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    const onMapPointerDown = (event: PointerEvent) => {
      if (open && event.target instanceof HTMLCanvasElement) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onMapPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onMapPointerDown);
    };
  }, [initializer, open]);

  const stripText = !initializer
    ? "Sign in to chat"
    : lastMessage
      ? `${lastMessage.sender.displayName?.trim() || lastMessage.sender.playerId}: ${lastMessage.content}`
      : "No messages yet";

  return (
    <div className="relative shrink-0">
      {open && (
        <section
          ref={pane}
          aria-label="Chat"
          className={cn(
            "pointer-events-auto absolute inset-x-0 bottom-full mb-2 flex h-[min(60vh,520px)] flex-col overflow-hidden rounded-xl",
            OVERLAY_SURFACE_BASE,
          )}
        >
          <RealtimeChatShell
            defaultZoneId={zoneId}
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
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "pointer-events-auto flex h-8 w-full items-center gap-2 rounded-xl px-3 text-left font-sans normal-case tracking-normal",
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
