import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ReactNode } from "react";
import { HUD_COLUMN_WIDTH } from "./hud-layout";
import { HudChatWindow } from "./hud-chat-window";

export const RightHudColumn = ({ children }: { children?: ReactNode }) => (
  <aside
    aria-label="Right column"
    className={cn("pointer-events-none fixed bottom-4 right-3 top-2 z-30 flex flex-col gap-2", HUD_COLUMN_WIDTH)}
  >
    <div className="min-h-[180px] flex-1 overflow-hidden">
      <HudChatWindow />
    </div>
    <div
      aria-label={children ? "Tile details" : undefined}
      className="pointer-events-auto flex min-h-0 max-h-[60%] shrink-0 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gold/20"
    >
      {children}
    </div>
  </aside>
);
