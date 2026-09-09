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
import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../../../../env";
import { HUD_SECTION_HEIGHT } from "./hud-layout";

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
  const [open, setOpen] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (view === LeftView.ChatView) {
      setOpen(true);
      setFocusRequest((request) => request + 1);
    }
  }, [view]);
  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => {
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
      setOpen(true);
      setFocusRequest((request) => request + 1);
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, []);
  useEffect(() => {
    if (focusRequest > 0)
      panel.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus();
  }, [focusRequest, open]);

  return (
    <section
      ref={panel}
      aria-label="Chat window"
      className={cn("pointer-events-auto flex shrink-0 flex-col overflow-hidden rounded-xl", OVERLAY_SURFACE_BASE)}
      style={{ height: open ? HUD_SECTION_HEIGHT : 36 }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 shrink-0 items-center justify-between border-b border-gold/15 px-3"
      >
        <span className={HUD_LABEL}>Chat</span>
        <span className="text-[10px] text-gold/50">
          {connection === "error" ? "Offline · " : ""}
          {open ? "Collapse" : "Enter ↵"}
        </span>
      </button>
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
