import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  RealtimeChatShell,
  type InitializeRealtimeClientParams,
  useRealtimeChatInitializer,
  useRealtimeChatSelector,
} from "@/ui/features/social";
import { configManager } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useRef } from "react";
import { env } from "../../../../../env";
import { ImportantEventFeed } from "@/ui/features/event-feed/important-event-feed";
import { useEventsPanelStore } from "@/ui/features/event-feed/events-panel-store";
import { useUnreadEvents } from "@/ui/features/event-feed/use-unread-events";

export function HudChatWindow() {
  const address = useAccountStore((state) => state.account?.address);
  const view = useUIStore((state) => state.leftNavigationView);
  const zoneId = `game:${configManager.getActiveGameId()}`;
  const initializer = useMemo<InitializeRealtimeClientParams | null>(
    () => (address && env.VITE_PUBLIC_CHAT_URL ? { baseUrl: env.VITE_PUBLIC_CHAT_URL, joinZones: [zoneId] } : null),
    [address, zoneId],
  );
  useRealtimeChatInitializer(initializer);
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const { tab, focusRequest, openChat, openEvents } = useEventsPanelStore();
  const open = tab === "chat";
  const unreadChat = useRealtimeChatSelector((state) => state.unreadWorldTotal + state.unreadDirectTotal);
  const setShellOpen = useRealtimeChatSelector((state) => state.actions.setShellOpen);
  const unreadEvents = useUnreadEvents(!open);
  useEffect(() => {
    setShellOpen(open);
    return () => setShellOpen(false);
  }, [open, setShellOpen]);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (view === LeftView.ChatView) {
      openChat();
    }
  }, [view, openChat]);
  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => {
      if (event.key === "Escape" && useEventsPanelStore.getState().tab === "chat") {
        event.preventDefault();
        event.stopImmediatePropagation();
        openEvents();
        return;
      }
      if (
        event.key !== "Enter" ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"]')
      )
        return;
      event.preventDefault();
      openChat();
    };
    window.addEventListener("keydown", onEnter, true);
    return () => window.removeEventListener("keydown", onEnter, true);
  }, [openChat, openEvents]);
  useEffect(() => {
    if (focusRequest > 0)
      panel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus();
  }, [focusRequest, open]);

  return (
    <section
      ref={panel}
      aria-label="Events and Chat"
      className={cn(
        "pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-xl",
        OVERLAY_SURFACE_BASE,
      )}
    >
      <div
        role="tablist"
        aria-label="Events and Chat"
        className="flex h-9 shrink-0 items-center gap-4 border-b border-gold/15 px-3"
      >
        <button type="button" role="tab" aria-selected={!open} onClick={() => openEvents()} className={HUD_LABEL}>
          Events {open && unreadEvents > 0 && <span aria-label="Unread events">{unreadEvents}</span>}
        </button>
        <button type="button" role="tab" aria-selected={open} onClick={openChat} className={HUD_LABEL}>
          Chat {!open && unreadChat > 0 && <span aria-label="Unread chat messages">{unreadChat}</span>}
        </button>
        {connection === "error" && <span className="text-xs text-gold/50">Offline</span>}
      </div>
      {!open && <ImportantEventFeed />}
      {open &&
        (initializer ? (
          <RealtimeChatShell
            defaultZoneId={zoneId}
            displayMode="embedded"
            autoInitializeClient={false}
            showInlineToggle={false}
            className="min-h-0 flex-1"
          />
        ) : (
          <p className="p-3 text-xs text-gold/60">Sign in to join chat.</p>
        ))}
    </section>
  );
}
