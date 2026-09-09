import { cn } from "@/ui/design-system/atoms/lib/utils";
import { QuickFeed } from "@/ui/features/event-feed/quick-feed";
import { type ReactNode } from "react";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { HudChatWindow } from "./hud-chat-window";

/** Feed at the top, tile details anchored to the bottom, the chat strip under them. */
export const RightHudColumn = ({ children }: { children?: ReactNode }) => (
  <aside
    aria-label="Right column"
    className={cn("pointer-events-none fixed bottom-4 right-3 z-30 flex flex-col gap-2", HUD_COLUMN_TOP, HUD_COLUMN_WIDTH)}
  >
    <QuickFeed />
    <div
      aria-label={children ? "Tile details" : undefined}
      className="pointer-events-auto mt-auto flex min-h-0 max-h-[60%] shrink-0 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gold/20"
    >
      {children}
    </div>
    <HudChatWindow />
  </aside>
);
