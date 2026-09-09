import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ImportantEventFeed } from "@/ui/features/event-feed/important-event-feed";
import { type ReactNode } from "react";
import { HUD_COLUMN_WIDTH, HUD_SECTION_HEIGHT } from "./hud-layout";
import { HudChatWindow } from "./hud-chat-window";

export const RightHudColumn = ({ children }: { children?: ReactNode }) => (
  <aside
    aria-label="Right column"
    className={cn("pointer-events-none fixed bottom-4 right-3 top-16 z-30 flex flex-col gap-2", HUD_COLUMN_WIDTH)}
  >
    <div className="shrink-0" style={{ height: HUD_SECTION_HEIGHT }}>
      <ImportantEventFeed />
    </div>
    <div
      aria-label={children ? "Tile details" : undefined}
      className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gold/20"
    >
      {children}
    </div>
    <HudChatWindow />
  </aside>
);
