import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ImportantEventFeed } from "@/ui/features/event-feed/important-event-feed";
import { type ReactNode, useEffect } from "react";

export const RightHudColumn = ({ children }: { children?: ReactNode }) => {
  const setView = useUIStore((state) => state.setLeftNavigationView);
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
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="dialog"]')
      )
        return;
      event.preventDefault();
      setView(LeftView.ChatView);
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [setView]);

  return (
    <aside
      aria-label="Right column"
      className="pointer-events-none fixed bottom-4 right-3 top-16 z-30 flex w-[300px] flex-col gap-2"
    >
      <div className="min-h-[25%] max-h-[33%] basis-1/3 shrink">
        <ImportantEventFeed />
      </div>
      <div className="min-h-0 flex-1" />
      {children && (
        <div
          aria-label="Tile details"
          className="pointer-events-auto flex min-h-0 max-h-[calc(75%-60px)] shrink flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gold/20"
        >
          {children}
        </div>
      )}
      <button
        type="button"
        onClick={() => setView(LeftView.ChatView)}
        className={cn(
          "pointer-events-auto flex h-9 shrink-0 items-center justify-between rounded-xl px-3 text-xs text-gold",
          OVERLAY_SURFACE_BASE,
        )}
      >
        <span>Chat</span>
        <span className="text-gold/50">Enter ↵</span>
      </button>
    </aside>
  );
};
